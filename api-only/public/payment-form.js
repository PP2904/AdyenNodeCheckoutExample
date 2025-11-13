async function initCheckout() {
  const configuration = {
    environment: "test",
    clientKey,
    onError: (error) => console.error("Checkout error:", error),
  };

  const checkout = await AdyenCheckout(configuration);

  // Mount card component
  const card = checkout.create("card", {
    hasHolderName: true,
    holderNameRequired: true,
    enableStoreDetails: true,
    onSubmit: async (state, component) => {
      if (!state.isValid) return;

      console.log("Encrypted card data:", state.data.paymentMethod);

      try {
        const response = await callServer("/api/payments", {
          paymentMethod: state.data.paymentMethod,
        });

        handleServerResponse(response, component);
      } catch (error) {
        console.error("Payment error:", error);
        alert("Payment failed. Check console for details.");
      }
    },
  }).mount("#card-container");

  // Optional: submit button
  const payButton = document.getElementById("payButton");
  payButton.addEventListener("click", () => card.submit());
}

async function callServer(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return await res.json();
}

function handleServerResponse(res, _component) {
  switch (res.resultCode) {
    case "Authorised":
      window.location.href = "/result/success";
      break;
    case "Pending":
    case "Received":
      window.location.href = "/result/pending";
      break;
    case "Refused":
      window.location.href = "/result/failed";
      break;
    default:
      window.location.href = "/result/error";
      break;
  }
}

initCheckout();