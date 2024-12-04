const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");
const { hmacValidator } = require("@adyen/api-library");
const { Client, Config, CheckoutAPI } = require("@adyen/api-library");

const app = express();

// Setup request logging
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

// Load environment variables
dotenv.config({ path: "./.env" });

// Adyen NodeJS library configuration
const config = new Config();
config.apiKey = process.env.ADYEN_API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST"); // Change to LIVE for production
const checkout = new CheckoutAPI(client);

// Register Handlebars view engine with `json` and `ifeq` helpers
app.engine(
  "handlebars",
  hbs.engine({
    defaultLayout: "main",
    layoutsDir: __dirname + "/views/layouts",
    helpers: {
      json: (context) => JSON.stringify(context),
      ifeq: (a, b, options) => (a === b ? options.fn(this) : options.inverse(this)),
    },
  })
);
app.set("view engine", "handlebars");

// Centralized helper function to get country and currency
function getCountryAndCurrency(type, providedCountry, providedCurrency) {
  // Default configurations based on payment method type
  const paymentConfigs = {
    card: { countryCode: "US", currency: "USD" },
    paypal: { countryCode: "US", currency: "USD" },
    twint: { countryCode: "CH", currency: "CHF" }, // Specific config for TWINT
  };

  // Use provided values if they exist, else fallback to defaults
  const defaultConfig = paymentConfigs[type] || { countryCode: "NL", currency: "EUR" };
  return {
    countryCode: providedCountry || defaultConfig.countryCode,
    currency: providedCurrency || defaultConfig.currency,
  };
}

/* ################# API ENDPOINTS ###################### */

// SESSIONS Call
app.post("/api/sessions", async (req, res) => {
  try {
    const { type = "default", country, currency } = req.body; // Get type, country, and currency from the request body
    const { countryCode, currency: resolvedCurrency } = getCountryAndCurrency(type, country, currency);

    console.log("Received Country:", countryCode);
    console.log("Received Currency:", resolvedCurrency);

    const orderRef = uuid();
    const localhost = req.get("host");
    const protocol = req.socket.encrypted ? "https" : "http";

    const response = await checkout.PaymentsApi.sessions({
      amount: { currency: resolvedCurrency, value: 10000 }, // Dynamically set currency
      countryCode, // Dynamically set country code
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      reference: orderRef,
      returnUrl: `${protocol}://${localhost}/checkout?orderRef=${orderRef}`,
      storePaymentMethodMode: "askForConsent",
      recurringProcessingModel: "CardOnFile",
      shopperReference: "1234", //"shopper_"+orderRef,
      lineItems: [
        { quantity: 1, amountIncludingTax: 5000, description: "Sunglasses" },
        { quantity: 1, amountIncludingTax: 5000, description: "Headphones" },
      ],
    });

    //log session response
    console.log("Session Response:", response);
    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode || 500).json(err.message);
  }
});

// Serve the index page
app.get("/", (req, res) => res.render("index"));

// Serve the preview page
app.get("/preview", (req, res) => {
  const { type = "default", country, currency } = req.query;
  const { countryCode, currency: resolvedCurrency } = getCountryAndCurrency(type, country, currency);

  console.log("Preview - Country:", countryCode);
  console.log("Preview - Currency:", resolvedCurrency);

  res.render("preview", {
    clientKey: process.env.ADYEN_CLIENT_KEY,
    type,
    countryCode,
    currency: resolvedCurrency,
  });
});

// Serve the checkout page
app.get("/checkout", (req, res) => {
  const { type = "default", country, currency } = req.query;
  const { countryCode, currency: resolvedCurrency } = getCountryAndCurrency(type, country, currency);

  const isMultiple = type === "multiple";
  const typeList = isMultiple ? ["card", "paypal", "twint", "riverty"] : [type];

  console.log("Checkout - Country:", countryCode);
  console.log("Checkout - Currency:", resolvedCurrency);

  res.render("checkout", {
    clientKey: process.env.ADYEN_CLIENT_KEY,
    typeList,
    isMultiple,
    countryCode,
    currency: resolvedCurrency,
  });
});

// Serve the result page
app.get("/result/:type", (req, res) =>
  res.render("result", {
    type: req.params.type,
  })
);

// Handle webhooks for notifications
app.post("/api/webhooks/notifications", async (req, res) => {
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator();
  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest.notificationItems;
  const notification = notificationRequestItems[0].NotificationRequestItem;

  if (validator.validateHMAC(notification, hmacKey)) {
    const merchantReference = notification.merchantReference;
    const eventCode = notification.eventCode;
    console.log("merchantReference:" + merchantReference + " eventCode:" + eventCode);

    consumeEvent(notification);
    res.status(202).send(); // Acknowledge the event
  } else {
    console.log("Invalid HMAC signature: " + notification);
    res.status(401).send("Invalid HMAC signature");
  }
});

// Function to process notification events
function consumeEvent(notification) {
  // Add item to DB, queue, or different thread
}

// Helper function to get the port
function getPort() {
  return process.env.PORT || 8080;
}

// Start the server
app.listen(getPort(), () => console.log(`Server started -> http://localhost:${getPort()}`));