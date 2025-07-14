// components.js

import AdyenCheckout from "@adyen/adyen-web";
import "@adyen/adyen-web/dist/adyen.css";

import {
  getPaymentMethods,
  postDoPayment,
  postDoPaymentDetails,
  postDoPaymentAuthorisation
} from "../../shared/payments";

import {
  renderResultTemplate,
  attachClickHandlerForReset,
  parseRedirectResultToRequestData,
  getFlowType
} from "../../shared/utils";

const CLIENT_KEY = import.meta.env.ADYEN_CLIENT_KEY;

// Declare as `let` so it can be reassigned later on radio button change
let flow = getFlowType(); // "native" or "redirect"

// ✅ Track changes to radio buttons
document.addEventListener("DOMContentLoaded", () => {
  const flowRadios = document.querySelectorAll('input[name="flow"]');
  flowRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      const selectedFlow = document.querySelector('input[name="flow"]:checked').value;
      flow = selectedFlow;
      console.log("Updated flow type:", flow);
    });
  });
});

let paymentMethodDetailsPaymentsAuth = null;
let globalBrowserInfo;
let paymentDetailsResponseGlobal = null;

const componentsInit = async () => {
  console.log("init of components advanced flow.");
  const url = window.location.href;

  if (url.includes("redirectResult")) {
    console.log("redirectResult in the url");
    const requestData = parseRedirectResultToRequestData(url);
    console.log("this is the requestData for redirect flow: ", requestData);

    const paymentDetailsResponse = await postDoPaymentDetails(requestData);
    console.log("/payments/details response:", paymentDetailsResponse);
    console.log("Auth-only response for redirect is here: ", paymentDetailsResponse.additionalData);

    renderResultTemplate(paymentResponse.resultCode); // Fix: was using paymentDetailsResponse.resultCode twice
  } else {
    const paymentMethods = await getPaymentMethods();
    console.log("paymentMethods response:", paymentMethods);

    const onSubmit = async (state, component) => {
      console.log("component on submit event", state, component);

      if (state.isValid) {
        console.log("this is the state.data for /payments call: ", state.data);

        paymentMethodDetailsPaymentsAuth = state.data.paymentMethod;
        globalBrowserInfo = state.data.browserInfo;

        const requestDataPayments = {
          paymentMethod: {
            ...state.data.paymentMethod,
            holderName: "Hans Wurst"
          },
          browserInfo: state.data.browserInfo,
          billingAddress: state.data.billingAddress,
          deliveryAddress: state.data.deliveryAddress,
          shopperName: state.data.shopperName,
          shopperIP: state.data.shopperIP,
          amount: {
            currency: "EUR",
            value: 1000 // This is for the initial /payments call, you might want to make this dynamic too
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
          const paymentData = paymentResponse.action?.paymentData;
          console.log("Stored paymentDataPaymentsAuth:", paymentData);
          localStorage.setItem("paymentDataPaymentsAuth", JSON.stringify(paymentData));
          console.log("paymentResponse includes an action, passing action to component.handleAction function.");
          component.handleAction(paymentResponse.action);
        }
      }
    };

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

      const paymentDetailsResponse = await postDoPaymentDetails(requestDataPaymentsDetails);
      console.log("requestData for payments/details: ", requestDataPaymentsDetails);
      renderResultTemplate(paymentDetailsResponse.resultCode);
      console.log("payments details response for Authorisation: ", paymentDetailsResponse);

      paymentDetailsResponseGlobal = paymentDetailsResponse;
      console.log("this is paymentDetailsResponseGlobal: ", paymentDetailsResponseGlobal);

      component.unmount();

      // Get references to the button and the new amount input's parent container
      const authMsg = document.querySelector(".auth-result-msg");
      const authoriseBtn = document.getElementById("authorise-btn");
      const amountInputContainer = document.querySelector('.input-group'); // Select the parent div of the input

      if (authMsg && authoriseBtn && amountInputContainer) { // Ensure all elements are found
        if (authMsg.textContent.trim() === "AuthenticationFinished") {
          authoriseBtn.style.display = "inline-block";
          amountInputContainer.style.display = "block"; // Make the amount input visible
        } else {
          authoriseBtn.style.display = "none";
          amountInputContainer.style.display = "none"; // Hide the amount input
        }
      }
    };

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

// authorisation request
export async function paymentAuthorisationResponse() {
  const url = window.location.href;

  if (!paymentDetailsResponseGlobal || !paymentMethodDetailsPaymentsAuth) {
    console.error("Missing required authentication data. Cannot proceed with authorisation.");
    return;
  }

  const paymentDataFromStorage = localStorage.getItem("paymentDataPaymentsAuth");

  if (!paymentDataFromStorage) {
    console.error("No paymentData found in localStorage. Aborting authorisation.");
    return;
  }

  const amountInput = document.getElementById("authorisationAmount");
  let userEnteredAmount = 500; // Default fallback amount

  if (amountInput && amountInput.value) {
    const parsedAmount = parseInt(amountInput.value, 10);
    if (!isNaN(parsedAmount) && parsedAmount >= 0) {
      userEnteredAmount = parsedAmount;
    } else {
      console.warn("Invalid amount entered, using default of 500.");
    }
  } else {
    console.warn("Authorisation amount input not found or empty, using default of 500.");
  }

  const requestDataPaymentsAuthorisation = {
    amount: {
      currency: "EUR",
      value: userEnteredAmount
    },
    channel: "Web",
    reference: "Auth-only_Authorisation_Test",
    paymentData: JSON.parse(paymentDataFromStorage),
    shopperInteraction: "Ecommerce",
    recurringProcessingModel: "CardOnFile",
    mpiData: {
      authenticationResponse: paymentDetailsResponseGlobal.additionalData?.threeDAuthenticatedResponse,
      directoryResponse: paymentDetailsResponseGlobal.additionalData?.['threeds2.threeDS2Result.transStatus'],
      cavv: paymentDetailsResponseGlobal.additionalData?.cavv,
      dsTransID: paymentDetailsResponseGlobal.additionalData?.['threeds2.threeDS2Result.dsTransID'],
      eci: paymentDetailsResponseGlobal.additionalData?.['threeds2.threeDS2Result.eci'],
      threeDSVersion: paymentDetailsResponseGlobal.additionalData?.threeDSVersion,
    },
    metaData: {
      pspRefFromDetails: paymentDetailsResponseGlobal.pspReference
    },
    paymentMethod: paymentMethodDetailsPaymentsAuth,
    browserInfo: globalBrowserInfo
  };

  console.log("requestData for payments (Authorisation): ", requestDataPaymentsAuthorisation);

  const paymentAuthorisationResponse = await postDoPaymentAuthorisation(
    requestDataPaymentsAuthorisation,
    { url, flow }
  );

  renderResultTemplate(paymentAuthorisationResponse.resultCode);
  console.log("payments Authorisation response: ", paymentAuthorisationResponse);

  localStorage.removeItem("paymentDataPaymentsAuth");
}

document.addEventListener("DOMContentLoaded", () => {
  const authoriseBtn = document.getElementById("authorise-btn");
  const authMsg = document.querySelector(".auth-result-msg");
  const amountInputContainer = document.querySelector('.input-group'); // Get reference to the amount input's container

  // Initial state: hide the amount input and authorise button
  if (authoriseBtn) {
    authoriseBtn.style.display = "none";
  }
  if (amountInputContainer) { // Ensure the container is hidden initially
    amountInputContainer.style.display = "none";
  }


  // Authorise button click handler
  if (authoriseBtn) {
    authoriseBtn.addEventListener("click", () => {
      console.log("Authorisation button clicked");
      paymentAuthorisationResponse();
    });
  }

  // Observer to watch for changes in authMsg textContent
  if (authMsg && authoriseBtn && amountInputContainer) {
    const observer = new MutationObserver(() => {
      if (authMsg.textContent.trim() === "AuthenticationFinished") {
        authoriseBtn.style.display = "inline-block";
        amountInputContainer.style.display = "block"; // Make the amount input visible
      } else {
        authoriseBtn.style.display = "none";
        amountInputContainer.style.display = "none"; // Hide the amount input
      }
    });
    observer.observe(authMsg, { childList: true, subtree: true });
  }
});

attachClickHandlerForReset();
componentsInit();