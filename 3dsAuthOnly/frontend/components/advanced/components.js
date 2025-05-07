import AdyenCheckout from "@adyen/adyen-web";
import "@adyen/adyen-web/dist/adyen.css";

import { getPaymentMethods, postDoPayment, postDoPaymentDetails } from "../../shared/payments";

import { renderResultTemplate, attachClickHandlerForReset, parseRedirectResultToRequestData, getFlowType } from "../../shared/utils";

const CLIENT_KEY = import.meta.env.ADYEN_CLIENT_KEY;

const flow = getFlowType(); // native or redirectxw

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
    // 1) get all available payment methods
    const paymentMethods = await getPaymentMethods();

    console.log("paymentMethods response:", paymentMethods);

    //2) payments call (auth-only)
    const onSubmit = async (state, component) => {
      console.log("component on submit event", state, component);
      if (state.isValid) {
        console.log("this is the state.data for /payments call: ", state.data)

        //use the payment method details in the Authorisation request (step 4)
        let paymentMethodDetailsPaymentsAuth = state.data;

        console.log("the paymentMethodDetails: ", paymentMethodDetailsPaymentsAuth);

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

        //ayments call (Auth-only)
        const paymentResponse = await postDoPayment(requestDataPayments, { url, flow });
        if (paymentResponse.resultCode === "Authorised") {
          console.log(`response is ${paymentResponse.resultCode}, unmounting component and rendering result`);
          //component.unmount();
          renderResultTemplate(paymentResponse.resultCode);
        } else {
          console.log("paymentResponse includes an action, passing action to component.handleAction function.");
          component.handleAction(paymentResponse.action); // pass the response action object into the dropinHandleAction function
        }
      }
    };

    const onAdditionalDetails = async (state, component) => {
      console.log("onadditionaldetails event", state);
 
      const requestDataPaymentsDetails = {
        // state.data = { details: { threeDSResult: "12345" } }
        //instead of threeds2.fingerprint we have to send in threeDSResult
        ...state.data, 
        authenticationData: {
          authenticationOnly: true,
        },
      };

      console.log("this is the state.data for /payments/details call: ", state.data)
    
      // 3) payments/details (getting the 3DS data back to handle Authorisation as a next step)

      const paymentDetailsResponse = await postDoPaymentDetails(requestDataPaymentsDetails);
      console.log("requestData for payments/details line 54: ", requestDataPaymentsDetails)
      //component.unmount();
      renderResultTemplate(paymentDetailsResponse.resultCode);
      console.log("payments details response for Authorisation: ",paymentDetailsResponse)

      //TBD
      //4) payments/details request (Authorisation request using 3ds and MPI data)

     // console.log("this is the state.data for /payments/details Authorisation call: ", state.data)

      const requestDataPaymentsDetailsAuthorisation = {
        //tbd 
        amount: {
        currency: "EUR",
        value: 1000
        },
        reference: "YOUR_ORDER_NUMBER",
        mpiData: {
          cavv: paymentDetailsResponse.additionalData.cavv,
          eci: paymentDetailsResponse.threeds2.threeDS2Result.eci,
          dsTransID:paymentDetailsResponse.threeds2.threeDS2Result.dsTransID,
          directoryResponse: paymentDetailsResponse.threeds2.threeDS2Result.directoryResponse,
          authenticationResponse: paymentDetailsResponse.threeds2.threeDS2Result.authenticationResponse,
          threeDSVersion: paymentDetailsResponse.threeds2.threeDS2Result.threeDSVersion,
          cavvAlgorithm : paymentDetailsResponse.threeds2.threeDS2Result.cavvAlgorithm,
          riskScore: paymentDetailsResponse.threeds2.threeDS2Result.riskScore
        },
        paymentMethod: {
          paymentMethodDetailsPaymentsAuth
        },      
      };

      const paymentDetailsAuthorisationResponse = await postDoPayment(requestDataPaymentsDetailsAuthorisation, { url, flow });
      console.log("requestData for payments (Authorisation) line 61: ", paymentDetailsAuthorisationResponse)
      component.unmount();
      renderResultTemplate(paymentDetailsAuthorisationResponse.resultCode);
      console.log("payments Authorisation response: ",paymentDetailsAuthorisationResponse)

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
