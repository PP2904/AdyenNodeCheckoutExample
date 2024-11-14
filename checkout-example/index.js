const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");
const { hmacValidator } = require('@adyen/api-library');
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
      json: (context) => JSON.stringify(context), // Helper to render JSON strings
      ifeq: (a, b, options) => (a === b ? options.fn(this) : options.inverse(this)), // ifeq helper to check for equality
    },
  })
);
app.set("view engine", "handlebars");

/* ################# API ENDPOINTS ###################### */

app.post("/api/sessions", async (req, res) => {
  try {
    const orderRef = uuid();
    const localhost = req.get("host");
    const protocol = req.socket.encrypted ? "https" : "http";

    const response = await checkout.PaymentsApi.sessions({
      amount: { currency: "EUR", value: 10000 }, // 100€ in minor units
      countryCode: "NL",
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT, // required
      reference: orderRef,
      returnUrl: `${protocol}://${localhost}/checkout?orderRef=${orderRef}`,
      lineItems: [
        { quantity: 1, amountIncludingTax: 5000, description: "Sunglasses" },
        { quantity: 1, amountIncludingTax: 5000, description: "Headphones" },
      ],
    });

    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

/* ################# CLIENT SIDE ENDPOINTS ###################### */

app.get("/", (req, res) => res.render("index"));

app.get("/checkout", (req, res) => {
  const type = req.query.type;

  // Define payment-specific configurations
  const paymentConfigs = {
    card: { countryCode: "US", currency: "USD" },
    paypal: { countryCode: "US", currency: "USD" },
    ideal: { countryCode: "NL", currency: "EUR" },
    twint: { countryCode: "CH", currency: "CHF" }, // Specific config for TWINT
  };

  const selectedConfig = paymentConfigs[type] || { countryCode: "NL", currency: "EUR" };

  if (type === "multiple") {
    const typeList = ["card", "paypal", "ideal", "twint"];
    res.render("checkout", {
      clientKey: process.env.ADYEN_CLIENT_KEY,
      typeList,
      isMultiple: true,
      countryCode: selectedConfig.countryCode,
      currency: selectedConfig.currency,
    });
  } else {
    res.render("checkout", {
      clientKey: process.env.ADYEN_CLIENT_KEY,
      typeList: [type],
      isMultiple: false,
      countryCode: selectedConfig.countryCode,
      currency: selectedConfig.currency,
    });
  }
});

app.get("/result/:type", (req, res) =>
  res.render("result", {
    type: req.params.type,
  })
);

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

function consumeEvent(notification) {
  // Add item to DB, queue, or different thread
}

function getPort() {
  return process.env.PORT || 8080;
}

app.listen(getPort(), () => console.log(`Server started -> http://localhost:${getPort()}`));