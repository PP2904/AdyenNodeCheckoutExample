const clientKey = document.getElementById("clientKey").innerHTML;
const type = document.getElementById("type").innerHTML;

// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId'); // Unique identifier for the payment session
const redirectResult = urlParams.get('redirectResult');

//hinzugefügt für v6 Adyen Checkout
//https://docs.adyen.com/online-payments/upgrade-your-integration/migrate-to-web-v6/
const { AdyenCheckout, Dropin, Card } = window.AdyenWeb;



async function startCheckout() {
  try {
    // Init Sessions
    const checkoutSessionResponse = await callServer("/api/sessions?type=" + type);

    // Create AdyenCheckout using Sessions response
    const checkout = await createAdyenCheckout(checkoutSessionResponse)
      //console.log(checkout)
    // Create an instance of Drop-in and mount it
    //changed from: checkout.create(type).mount(document.getElementById(type));
    //console.log("this is dropin active payment methods data: ", type.activePaymentMethod.data)
    checkout.mount(document.getElementById(type));
    

  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

// Some payment methods use redirects. This is where we finalize the operation
async function finalizeCheckout() {
    try {
        // Create AdyenCheckout re-using existing Session
        const checkout = await createAdyenCheckout({id: sessionId});

        // Submit the extracted redirectResult (to trigger onPaymentCompleted() handler)
        checkout.submitDetails({details: {redirectResult}});
    } catch (error) {
        console.error(error);
        alert("Error occurred. Look at console for details");
    }
}

async function createAdyenCheckout(session) {
  
    const configuration = {
        clientKey,
        countryCode:"US",
        locale: "en_US",
        environment: "test",  // change to live for production
        showPayButton: true,
        session: session,
        onPaymentCompleted: (result, component) => {
            //here you can get the sessionResult
            console.log("here is the sessionResult", result)
            handleServerResponse(result, component);
        },
        onError: (error, component) => {
            console.error(error.name, error.message, error.stack, component);
        }
    };


    const checkout = await AdyenCheckout(configuration)
    //here you can get the sessionId from 
    console.log("this is adyenCheckout ", checkout)
      const dropin = await new Dropin(checkout, {
        paymentMethodComponents: [Card], // Only needed with tree-shakable npm package
        paymentMethodsConfiguration: { 
          ideal: {
              showImage: true
          },
          card: {
              hasHolderName: true,
              holderNameRequired: true,
              name: "Credit or debit card",
              amount: {
                  value: 10000,
                  currency: "EUR"
              },
              //change placeholder names in checkout v6
              placeholders: { cardNumber: 'HansOtto', expiryDate: '📅' }
          },
          paypal: {
              amount: {
                  currency: "USD",
                  value: 10000
              },
              environment: "test",
              countryCode: "US"   // Only needed for test. This will be automatically retrieved when you are in production.
          }
      }, })
  
      return dropin

    }

    //console.log("this is checkout ", checkout)


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

if (!sessionId) {
    startCheckout();
}
else {
    // existing session: complete Checkout
    finalizeCheckout();
}