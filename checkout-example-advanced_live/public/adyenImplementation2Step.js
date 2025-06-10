const clientKey = document.getElementById("clientKey").innerHTML;
//checkout.handlebars defines the id for the innerHTML
//More precisely, innerHTML gets a serialization of the nested child DOM elements within the element, or sets HTML or XML that should be parsed to replace the DOM tree within the element.
const type = document.getElementById("type").innerHTML;

async function initCheckout() {
  try {
    const paymentMethodsResponse = await callServer("/api/getPaymentMethods");
    const configuration = {
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      locale: "en_US",
      environment: "test",
      showPayButton: false,
      paymentMethodsConfiguration: {
        ideal: {
          showImage: true,
        },
        card: {
          hasHolderName: true,
          holderNameRequired: true,
          name: "Credit or debit card",
          //hideCVC: true,
          showPayButton: false,
          amount: {
            value: 999,
            currency: "EUR",
          },
          //from https://docs.adyen.com/payment-methods/cards/web-component/#optional-configuration
          //hasHolderName: true, // Show the cardholder name field.
          //holderNameRequired: true, // Mark the cardholder name field as required.
          //billingAddressRequired: true, // Show the billing address input fields and mark them as required.

          //Card Component Event Handlers
          //from https://docs.adyen.com/payment-methods/cards/web-component/#optional-configuration:~:text=callback.-,Events,-You%20can%20also
          onConfigSuccess: (data) => {
            console.log("loaded")
          },
          onChange: () => {
            console.log("changed")
          },
          /* //click to pay config
          clickToPayConfiguration: {
            //Card PAN enrolled for CTP for MC: 5186001700008785
            merchantDisplayName: 'YOUR_MERCHANT_NAME',
            shopperEmail: 'peter.pfrommer@adyen.com' // Used to recognize your shopper's Click to Pay account.
          } */
        },
        paypal: {
          environment: "test", // Change this to "live" when you are ready to accept live PayPal payments.
          countryCode: "DE", // Only needed for test. When live, this is retrieved automatically.
          amount: {
            currency: "EUR",
            value: 10000
                  },
        }
      },
      onSubmit: (state, component) => {
        if (state.isValid) {
          handleSubmission(state, component, "/api/initiatePayment");
        }
      },
      onAdditionalDetails: (state, component) => {
        handleSubmission(state, component, "/api/submitAdditionalDetails");
      },
      onChange: (state, component) => {
        //console.log("this is the state data: ", state.data)
        //console.log("this is the component: ", component)
        // Store the state.data in local storage
        //const cardBrand = state.data.paymentMethod.brand
        //const cardSummary = ...
        localStorage.setItem("paymentStateData", JSON.stringify(state.data));
        console.log("State data saved to local storage:", state.data);

      }
    };

    const checkout = await new AdyenCheckout(configuration);
    //console.log("here the type: ", type)
    //console.log("this is dropin active payment methods data: ", type.activePaymentMethod.data)
    checkout.create(type).mount(document.getElementById(type));
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
  
}


// Event handlers called when the shopper selects the pay button,
// or when additional information is required to complete the payment
async function handleSubmission(state, component, url) {
  try {
    const res = await callServer(url, state.data);
    handleServerResponse(res, component);
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

// Calls your server endpoints
async function callServer(url, data) {
  const res = await fetch(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : "",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await res.json();
}

// Handles responses sent from your server to the client
function handleServerResponse(res, component) {
  if (res.action) {
    component.handleAction(res.action);
  } else {
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
}

initCheckout();
