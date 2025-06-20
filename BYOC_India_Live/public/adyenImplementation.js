//FE configs

const clientKey = document.getElementById("clientKey").innerHTML;
//checkout.handlebars defines the id for the innerHTML
//More precisely, innerHTML gets a serialization of the nested child DOM elements within the element, or sets HTML or XML that should be parsed to replace the DOM tree within the element.
const type = document.getElementById("type").innerHTML;

//config for card component
const cardConfiguration = {
   //https://docs.adyen.com/payment-methods/cards/web-drop-in/#configuration
          name: "Credit or debit card",
          showPayButton: true,
          enableStoreDetails: false,
          showStoredPaymentMethods: false,
          maskSecurityCode: true,
          //defines amount displayed in the Component
          amount: {
            value: 80,
            currency: "INR",
          },
          onConfigSuccess: (data) => {
            console.log("loaded")
          },
          
          onChange: () => {
            console.log("changed")
          },

          onSubmit: (state, component) => {
            if (state.isValid) {
              handleSubmission(state, component, "/api/initiatePayment");
            }
            console.log("onSubmit")
          },

          onAdditionalDetails: (state, component) => {
            handleSubmission(state, component, "/api/submitAdditionalDetails");
          },

          onFieldValid: (state, component) => {
            console.log("thats the state from onFieldValid: ", state)
            console.log('thats the issuer BIN: ', state.issuerBin)
            console.log("that's the component ", component)
          },

          //does not work with Amex - yes, 16 digit PAN needed
          onBinLookup: (state,component) => {
            console.log("onBinLookUp: ",state)
          },

          onBinValue: (state,component) => {
            console.log("onBinValue: ",state)
          }
};

//https://docs.adyen.com/online-payments/build-your-integration/advanced-flow/?platform=Web&integration=Drop-in&version=6.16.0#add
//dropin config where?

async function initCheckout() {
  try {
    const paymentMethodsResponse = await callServer("/api/getPaymentMethods");
    const configuration = {
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      locale: "en_US",
      //change to live here too!
      environment: "live-in",
      paymentMethodsConfiguration: {
        card: cardConfiguration
      }
    };

    const checkout = await new AdyenCheckout(configuration);
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

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    console.error(`Expected JSON but got: ${contentType}`);
    console.error("Response text:", text);
    throw new Error("Server response is not JSON.");
  }

  return JSON.parse(text);
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
