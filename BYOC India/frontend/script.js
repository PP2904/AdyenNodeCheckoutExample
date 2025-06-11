async function initCheckout() {
  const clientKey = "live_3ZEWUSS7CZGFBE546HSARDHPRM5NOJSL"; // Your LIVE client key

  // 1. Get available payment methods from your backend
  const paymentMethodsResponse = await fetch("http://localhost:8080/api/getPaymentMethods", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  }).then(res => res.json());

  // 2. Create Adyen Checkout instance
  const configuration = {
    environment: "live",
    clientKey,
    paymentMethodsResponse,
    onSubmit: (state, dropin) => {
      fetch("http://localhost:8080/api/initiatePayment", {
        method: "POST",
        body: JSON.stringify(state.data),
        headers: { "Content-Type": "application/json" }
      })
      .then(res => res.json())
      .then(response => {
        if (response.action) {
          dropin.handleAction(response.action);
        } else {
          alert("Payment result: " + response.resultCode);
        }
      });
    },
    onAdditionalDetails: (state, dropin) => {
      fetch("http://localhost:8080/api/submitAdditionalDetails", {
        method: "POST",
        body: JSON.stringify(state.data),
        headers: { "Content-Type": "application/json" }
      })
      .then(res => res.json())
      .then(response => {
        if (response.action) {
          dropin.handleAction(response.action);
        } else {
          alert("Payment result: " + response.resultCode);
        }
      });
    }
  };

  const checkout = await AdyenCheckout(configuration);
  checkout.create("dropin").mount("#dropin-container");
}

initCheckout();