import AdyenCheckout from "@adyen/adyen-web";
import "@adyen/adyen-web/dist/adyen.css";

import {
  getPaymentMethods,
  postDoPayment,
  postDoPaymentDetails
} from "../../shared/payments";

import {
  renderResultTemplate,
  attachClickHandlerForReset,
  parseRedirectResultToRequestData,
  getFlowType
} from "../../shared/utils";

const CLIENT_KEY = import.meta.env.ADYEN_CLIENT_KEY;
const flow = getFlowType(); // native or redirect

// ✅ Declare shared variables for reuse across functions
let paymentMethodDetailsPaymentsAuth = null;
let globalBrowserInfo;
let paymentDetailsResponseGlobal = null; // 🆕 store payment details for final authorisation step

const componentsInit = async () => {
  console.log("init of components advanced flow.");
  const url = window.location.href;

  // *** redirect flow ***
  if (url.indexOf("redirectResult") !== -1) {
    console.log("redirectResult in the url");
    const requestData = parseRedirectResultToRequestData(url);
    console.log("this is the requestData for redirect flow: ", requestData);
    
    const paymentDetailsResponse = await postDoPaymentDetails(requestData);
    console.log("/payments/details response:", paymentDetailsResponse);
    console.log("Auth-only response for redirect is here: ", paymentDetailsResponse.additionalData);

    renderResultTemplate(paymentDetailsResponse.resultCode);

  // *** native flow ***
  } else {
    // 1) Get all available payment methods
    const paymentMethods = await getPaymentMethods();
    console.log("paymentMethods response:", paymentMethods);

    // 2) payments call (auth-only)
    const onSubmit = async (state, component) => {
      console.log("component on submit event", state, component);
      if (state.isValid) {
        console.log("this is the state.data for /payments call: ", state.data);

        // ✅ Store payment method details for reuse later
        paymentMethodDetailsPaymentsAuth = state.data.paymentMethod;
        globalBrowserInfo = state.data.browserInfo;

        console.log("the paymentMethodDetails: ", paymentMethodDetailsPaymentsAuth);

        /* const requestDataPayments = {
          ...state.data,
          paymentMethod: {
            ...state.data.paymentMethod,
            // Replace with the desired value
            holderName: "Hans Wurst"
          },
          shopperConversionId: `shopper123`,
          authenticationData: {
            authenticationOnly: true,
            threeDSRequestData: {
              nativeThreeDS: "preferred"
            }
          },
          metaData: {
            testData: `1234`
          }
        };
         */

        const requestDataPayments = {
          paymentMethod: {
            ...state.data.paymentMethod,
            holderName: "Hans Wurst"
          },
          browserInfo: state.data.browserInfo,
          billingAddress: state.data.billingAddress,
          deliveryAddress: state.data.deliveryAddress,
          shopperName: state.data.shopperName,
          //shopperEmail: state.data.shopperEmail,
          shopperIP: state.data.shopperIP,
          amount: {
            currency: "EUR",
            value: 1000
          },
          authenticationData: {
            authenticationOnly: true,
            threeDSRequestData: {
              nativeThreeDS: "preferred"
            }
          },
          shopperConversionId: `shopper123`,
          metaData: {
            testData: `1234`
          }
        };

        console.log("this is the requestData for /payments call: ", requestDataPayments);

        const paymentResponse = await postDoPayment(requestDataPayments, { url, flow });
        if (paymentResponse.resultCode === "Authorised") {
          console.log(`response is ${paymentResponse.resultCode}, unmounting component and rendering result`);
          renderResultTemplate(paymentResponse.resultCode);
        } else {
          console.log("paymentResponse includes an action, passing action to component.handleAction function.");
          component.handleAction(paymentResponse.action);
        }
      }
    };

    // 3) payments/details (3DS step and final authorisation)
    const onAdditionalDetails = async (state, component) => {
      console.log("onadditionaldetails event", state);

      const requestDataPaymentsDetails = {
        ...state.data,
        authenticationData: {
          authenticationOnly: true
        },
        shopperConversionId: `shopper123`,
        metaData: {
          testData: `1234`
        }
      };

      console.log("this is the state.data for /payments/details call: ", state.data);

      const paymentDetailsResponse = await postDoPaymentDetails(requestDataPaymentsDetails);
      console.log("requestData for payments/details line 98: ", requestDataPaymentsDetails);
      renderResultTemplate(paymentDetailsResponse.resultCode);
      console.log("payments details response for Authorisation: ", paymentDetailsResponse);

      // ✅ Save for use in paymentAuthorisationResponse
      paymentDetailsResponseGlobal = paymentDetailsResponse;

      // ✅ Use shared variable from onSubmit for auth call
      console.log("this is payment method for Authorisation: ", paymentMethodDetailsPaymentsAuth);

      component.unmount();

      // ✅ Conditionally show "Authorise Payment now!" button if auth was successful
      const authMsg = document.querySelector(".auth-result-msg");
      const authoriseBtn = document.getElementById("authorise-btn");

      if (authMsg && authoriseBtn) {
        if (authMsg.textContent.trim() === "AuthenticationFinished") {
          authoriseBtn.style.display = "inline-block";
        } else {
          authoriseBtn.style.display = "none";
        }
      }
    };

    //Create config and mount Adyen Drop-in
    const checkoutConfig = {
      paymentMethodsResponse: paymentMethods,
      locale: "en_US",
      environment: "test",
      clientKey: CLIENT_KEY,
      analytics: { enabled: false },
      onSubmit: onSubmit,
      onAdditionalDetails: onAdditionalDetails,
      showPayButton: true
    };

    const checkout = await AdyenCheckout(checkoutConfig);
    console.log("created checkout instance with config:", checkoutConfig);

    checkout.create("card").mount("#component-container");
    console.log("created and mounted card component to #component-container");
  }
};

// ✅ Final Authorisation request using 3DS and MPI data
export async function paymentAuthorisationResponse() {
  const url = window.location.href;

  if (!paymentDetailsResponseGlobal || !paymentMethodDetailsPaymentsAuth) {
    console.error("Missing required authentication data. Cannot proceed with authorisation.");
    return;
  }

  const requestDataPaymentsAuthorisation = {
    amount: {
      currency: "EUR",
      value: 1000
    },
    channel: "Web",
    reference: "Auth-only_Authorisation_Test",
    mpiData: {
      cavv: paymentDetailsResponseGlobal.additionalData?.cavv,
      eci: paymentDetailsResponseGlobal.additionalData?.["threeds2.threeDS2Result.eci"],
      dsTransID: paymentDetailsResponseGlobal.additionalData?.["threeds2.threeDS2Result.dsTransID"],
      //directory response = transStatus from the ARes (Authentication Response).
      directoryResponse: paymentDetailsResponseGlobal.additionalData?.["threeds2.threeDS2Result.transStatus"],
      authenticationResponse: paymentDetailsResponseGlobal.additionalData?.threeDAuthenticatedResponse,
      threeDSVersion: paymentDetailsResponseGlobal.additionalData?.threeDSVersion,
      //only Cartes Bancaires
      //cavvAlgorithm: paymentDetailsResponseGlobal.additionalData?.["threeds2.threeDS2Result.cavvAlgorithm"],
      //only Cartes Bancaires
      //paymentDetailsResponseGlobal.additionalData?.["threeds2.threeDS2Result.riskScore"]
      shopperInteraction: "Ecommerce",
      recurringProcessingModel: "CardOnFile",
      authenticationData: {
        attemptAuthentication: "never"
      }
    },
    paymentMethod: paymentMethodDetailsPaymentsAuth,
    browserInfo: globalBrowserInfo
  };

  console.log("requestData for payments (Authorisation): ", requestDataPaymentsAuthorisation);
  
  //Authorisation payments call
  //postDoPayment is defined/implemented in payments.js (...3dsAuthOnly/frontend/shared/payments.js)
  const paymentAuthorisationResponse = await postDoPayment(
    requestDataPaymentsAuthorisation,
    { url, flow }
  );
  renderResultTemplate(paymentAuthorisationResponse.resultCode);
  console.log("payments Authorisation response: ", paymentAuthorisationResponse);
}

// ✅ Setup click listener and MutationObserver to toggle button visibility
document.addEventListener("DOMContentLoaded", () => {
  const authoriseBtn = document.getElementById("authorise-btn");
  const authMsg = document.querySelector(".auth-result-msg");

  if (authoriseBtn) {
    authoriseBtn.style.display = "none"; // hide by default
    authoriseBtn.addEventListener("click", paymentAuthorisationResponse);
  }

  // Observe dynamic updates to the auth result message
  if (authMsg) {
    const observer = new MutationObserver(() => {
      if (authMsg.textContent.trim() === "AuthenticationFinished") {
        authoriseBtn.style.display = "inline-block";
      } else {
        authoriseBtn.style.display = "none";
      }
    });
    observer.observe(authMsg, { childList: true, subtree: true });
  }
});

attachClickHandlerForReset();
componentsInit();
