import AdyenCheckout from "@adyen/adyen-web";
import "@adyen/adyen-web/dist/adyen.css";

import { getPaymentMethods, postDoPayment, postDoPaymentDetails } from "../../shared/payments";

import { renderResultTemplate, attachClickHandlerForReset, parseRedirectResultToRequestData, getFlowType } from "../../shared/utils";

const CLIENT_KEY = import.meta.env.ADYEN_CLIENT_KEY;

const componentsInit = async () => {
  console.log("init of components advanced flow.");
  const url = window.location.href;

 
//*** redirect flow ***

  if (url.indexOf("redirectResult") !== -1) {
    console.log("redirectResult in the url");
    const requestData = parseRedirectResultToRequestData(url);
    console.log("this is the requestData for redirect flow: ", requestData)
    //TODO: how does auth only work for redirect? (Check slide 8 Yuu)
    const paymentDetailsResponse = await postDoPaymentDetails(requestData);

    console.log("/payments/details response:", paymentDetailsResponse);
    console.log("Auth-only response for redirect is here: ", paymentDetailsResponse.additionalData)

    renderResultTemplate(paymentDetailsResponse.resultCode);

//*** native flow ***

  } else {
    // first get all available payment methods
    const paymentMethods = await getPaymentMethods();

    console.log("paymentMethods response:", paymentMethods);

    const onAdditionalDetails = async (state, component) => {
      console.log("onadditionaldetails event", state);
      /* const requestData = {
        ...state.data,
      }; */

      const requestData = {
        ...state.data, // includes { details: { threeDSResult: "12345" } }
        authenticationData: {
          authenticationOnly: true,
        },
      };
    

      const paymentDetailsResponse = await postDoPaymentDetails(requestData);
      console.log("requestData for payments/details line 50: ", requestData)
      component.unmount();
      renderResultTemplate(paymentDetailsResponse.resultCode);
      console.log("payments details response: ",paymentDetailsResponse)
    };

    const onSubmit = async (state, component) => {
      console.log("component on submit event", state, component);
      //payments call
      if (state.isValid) {
        const flow = getFlowType(); // native or redirect
        console.log("this is the state.data for /payments call: ", state.data)

        const requestDataPayments = {
          ...state.data,
          authenticationData: {
            authenticationOnly: true,
            threeDSRequestData:{
              nativeThreeDS: "preferred"
            }
          },
        };

        console.log("this is the requestData for /payments call: ", requestDataPayments)


        const paymentResponse = await postDoPayment(requestDataPayments, { url, flow });
        if (paymentResponse.resultCode === "Authorised") {
          console.log(`response is ${paymentResponse.resultCode}, unmounting component and rendering result`);
          component.unmount();
          renderResultTemplate(paymentResponse.resultCode);
        } else {
          console.log("paymentResponse includes an action, passing action to component.handleAction function.");
          component.handleAction(paymentResponse.action); // pass the response action object into the dropinHandleAction function
        }
      }
    };

    // create configuration object to pass into AdyenCheckout
    const checkoutConfig = {
      paymentMethodsResponse: paymentMethods,
      locale: "en_US",
      environment: "test",
      clientKey: CLIENT_KEY,
      analytics: { enabled: false }, // omit or set to true if you want to enable analytics, this can be helpful if we need to debug issues on the Adyen side
      onSubmit: onSubmit,
      onAdditionalDetails: onAdditionalDetails,
      showPayButton: true,
    };

    const checkout = await AdyenCheckout(checkoutConfig);
    console.log("created checkout instance with config:", checkoutConfig);

    checkout.create("card").mount("#component-container");
    console.log("created and mounted card component to #component-container");
  }
};

attachClickHandlerForReset();
componentsInit();
