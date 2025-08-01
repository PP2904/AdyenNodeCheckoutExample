require('dotenv').config({ override: true });

const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");
const { hmacValidator } = require('@adyen/api-library');
const { Client, Config, CheckoutAPI } = require("@adyen/api-library");

// init app
const app = express();
// setup request logging
app.use(morgan("dev"));
// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// Serve client from build folder
app.use(express.static(path.join(__dirname, "/public")));

// enables environment variables by
// parsing the .env file and assigning it to process.env
dotenv.config({
  path: "./.env",
});

//checking .env file correct
console.log("Loaded env vars:");
console.log("ADYEN_API_KEY:", process.env.ADYEN_API_KEY ? "✔️" : "❌");
//console.log("ADYEN_API_KEY:", process.env.ADYEN_API_KEY);
console.log("ADYEN_PREFIX:", process.env.ADYEN_PREFIX);
console.log("ADYEN_CLIENT_KEY:", process.env.ADYEN_CLIENT_KEY);
console.log("ADYEN_ENVIRONMENT:", process.env.ADYEN_ENVIRONMENT);
console.log("ADYEN_MERCHANT_ACCOUNT:", process.env.ADYEN_MERCHANT_ACCOUNT);

// Adyen Node.js API library boilerplate (configuration, etc.)
const config = new Config();
config.apiKey = process.env.ADYEN_API_KEY;

const client = new Client({ config });
client.setEnvironment("LIVE", process.env.ADYEN_PREFIX); // Change to LIVE for production

const checkout = new CheckoutAPI(client);


app.engine(
  "handlebars",
  hbs.engine({
    defaultLayout: "main",
    layoutsDir: __dirname + "/views/layouts",
    helpers: require("./util/helpers"),
  })
);

app.set("view engine", "handlebars");

/* ################# API ENDPOINTS ###################### */

//endpoints defined in file: /workspace/AdyenNodeCheckoutExample/checkout-example-advanced live/node_modules/@adyen/api-library/lib/src/service.js
// and in file: checkout-example-advanced live/node_modules/@adyen/api-library/lib/src/client.js
// Get payment methods

console.log("ADYEN_API_KEY loaded:", !!process.env.ADYEN_API_KEY);

app.post("/api/getPaymentMethods", async (req, res) => {
  try {
    const response = await checkout.PaymentsApi.paymentMethods({
      channel: "Web",
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      //important for /paymentMethods to show the storedPaymentMethods
      shopperReference: "1234_AUD_LiveTest",
      //separate debit and credit card fields
      //splitCardFundingSources:true
    });
    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

// submitting a payment
app.post("/api/initiatePayment", async (req, res) => {
  const currency = "INR"
  // find shopper IP from request
  const shopperIP = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  try {
    // unique ref for the transaction
    const orderRef = uuid();
    // allows for gitpod support
    const localhost = req.get('host');
    // const isHttps = req.connection.encrypted;
    const protocol = req.socket.encrypted? 'https' : 'http';    

    //define /payments call
    // ideally the data passed here should be computed based on business logic
    const response = await checkout.PaymentsApi.payments({
      amount: { currency, value: 10 }, 
      reference: orderRef, // required
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT, // required
      channel: "Web", // required
      origin: `${protocol}://${localhost}`, // required for 3ds2 native flow
      browserInfo: req.body.browserInfo, // required for 3ds2
      shopperIP, // required by some issuers for 3ds2

      //Tokenization params
      storePaymentMethod: true,
      recurringProcessingModel: "CardOnFile",
      shopperInteraction:"Ecommerce",
      shopperReference: "1234",

      //3DS
      authenticationData: {
        attemptAuthentication: "always",
        // add the following line for Native 3DS2 > see also 3ds2-example folder
        /* threeDSRequestData: {
        nativeThreeDS: "preferred"
        } */
      },
      returnUrl: `${protocol}://${localhost}/api/handleShopperRedirect?orderRef=${orderRef}`, // required for 3ds2 redirect flow
      // we strongly recommend that you the billingAddress in your request. 
      // card schemes require this for channel web, iOS, and Android implementations.
      billingAddress: {
        city: "Amsterdam",
        country: "NL",
        houseNumberOrName: "6-50",
        postalCode: "1011 DJ",
        street: "Simon Carmiggeltstraat"
    },
      deliveryDate: new Date("2017-07-17T13:42:40.428+01:00"),
      shopperStatement: "LiveDemoAUD",
      shopperEmail: "peter.pfrommer@adyen.com",
      shopperLocale: "en_US",
      telephoneNumber: "+31858888138",
      //https://hub.is.adyen.com/our-solution/payments/payments-engine/payment-methods/ratepay#technical_configuration
      lineItems: [
        {
            quantity: 1,
            amountExcludingTax: 50,
            taxPercentage: 0,
            description: "Shoes",
            id: "Item #1",
            taxAmount: 0,
            amountIncludingTax: 50,
            taxCategory: "High"
        },
        {
            quantity: 2,
            amountExcludingTax: 50,
            taxPercentage: 0,
            description: "Socks",
            id: "Item #2",
            taxAmount: 0,
            amountIncludingTax: 50,
            taxCategory: "High"
        }
    ]
      //additionalData fields for advanced flow
     /*  additionalData:{
        "authorisationType":"PreAuth"
        }, */
    });

    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.post("/api/submitAdditionalDetails", async (req, res) => {
  // Create the payload for submitting payment details
  const payload = {
    details: req.body.details,
    paymentData: req.body.paymentData,
  };

  try {
    // Return the response back to client
    // (for further action handling or presenting result to shopper)
    const response = await checkout.PaymentsApi.paymentsDetails(payload);

    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

// Handle all redirects from payment type
app.all("/api/handleShopperRedirect", async (req, res) => {
  // Create the payload for submitting payment details
  const redirect = req.method === "GET" ? req.query : req.body;
  const details = {};
  if (redirect.redirectResult) {
    details.redirectResult = redirect.redirectResult;
  } else if (redirect.payload) {
    details.payload = redirect.payload;
  }

  try {
    const response = await checkout.PaymentsApi.paymentsDetails({ details });
    // Conditionally handle different result codes for the shopper
    switch (response.resultCode) {
      case "Authorised":
        res.redirect("/result/success");
        break;
      case "Pending":
      case "Received":
        res.redirect("/result/pending");
        break;
      case "Refused":
        res.redirect("/result/failed");
        break;
      default:
        res.redirect("/result/error");
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.redirect("/result/error");
  }
});

/* ################# end API ENDPOINTS ###################### */

/* ################# CLIENT SIDE ENDPOINTS ###################### */

// Index (select a demo)
app.get("/", (req, res) => res.render("index"));

// Cart (continue to preview for 2 Step)
app.get("/preview2Step", (req, res) =>
  res.render("preview2Step", {
    type: req.query.type,
  })
);

// Cart (continue to checkout)
app.get("/preview", (req, res) =>
  res.render("preview", {
    type: req.query.type,
  })
);

/*Where is the type coming from?
the type is set from the place i suggested:
 req.query.type points to the type that is set in the query parameter of the URL
 */

// Checkout page (make a payment)
app.get("/checkout", (req, res) =>
  res.render("checkout", {
    type: req.query.type,
    clientKey: process.env.ADYEN_CLIENT_KEY,
  })
);

// Checkout page 2 step (make a payment)
app.get("/checkout2Step", (req, res) =>
  res.render("checkout2Step", {
    type: req.query.type,
    clientKey: process.env.ADYEN_CLIENT_KEY,
  })
);


// Result page
app.get("/result/:type", (req, res) =>
  res.render("result", {
    type: req.params.type,
  })
);

/* ################# end CLIENT SIDE ENDPOINTS ###################### */

/* ################# WEBHOOK ###################### */

// Process incoming Webhook: get NotificationRequestItem, validate HMAC signature,
// consume the event asynchronously, send response status code 202
/* app.post("/api/webhooks/notifications", async (req, res) => {

  // YOUR_HMAC_KEY from the Customer Area
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator()
  // Notification Request JSON
  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest.notificationItems

  // fetch first (and only) NotificationRequestItem
  const notification = notificationRequestItems[0].NotificationRequestItem
  console.log(notification)
  
  // Handle the notification
  if( validator.validateHMAC(notification, hmacKey) ) {
    // valid hmac: process event
    const merchantReference = notification.merchantReference;
    const eventCode = notification.eventCode;
    console.log("merchantReference:" + merchantReference + " eventCode:" + eventCode);

    // consume event asynchronously
    consumeEvent(notification);

    // acknowledge event has been consumed
    res.status(202).send(); // Send a 202 response with an empty body

  } else {
    // invalid hmac
    console.log("Invalid HMAC signature: " + notification);
    res.status(401).send('Invalid HMAC signature');
  }

}); */

app.post("/api/webhooks/notifications", async (req, res) => {
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator();
  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest.notificationItems;

  const notification = notificationRequestItems[0].NotificationRequestItem;
  console.log(notification);

  try {
    if (validator.validateHMAC(notification, hmacKey)) {
      console.log("Valid HMAC. Processing...");
      const merchantReference = notification.merchantReference;
      const eventCode = notification.eventCode;
      console.log("merchantReference:" + merchantReference + " eventCode:" + eventCode);

      consumeEvent(notification);
      res.status(202).send(); // or 200 depending on Adyen setup
    } else {
      console.log("Invalid HMAC signature.");
      res.status(401).send('Invalid HMAC signature');
    }
  } catch (err) {
    console.error("HMAC validation failed:", err.message);
    res.status(400).send('Missing or invalid HMAC signature');
  }
});


// process payload asynchronously
function consumeEvent(notification) {
  // add item to DB, queue or different thread
  
}


// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started -> http://localhost:${PORT}`));
