// index.js
const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");

const { hmacValidator } = require("@adyen/api-library");
const { Client, Config, CheckoutAPI, RecurringAPI } = require("@adyen/api-library");
const { SHOPPER_REFERENCE, getAll, put, remove } = require("./storage.js");

// Load environment variables
dotenv.config({ path: "./.env" });

const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

// Adyen client setup
const config = new Config();
config.apiKey = process.env.ADYEN_API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST"); // Change to LIVE for production
const checkout = new CheckoutAPI(client);
const recurring = new RecurringAPI(client);

// Handlebars view engine
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

// API-only: directly call /payments with encrypted card data
app.post("/api/payments", async (req, res) => {
  console.log("PAYMENTS endpoint hit");
  console.log("Body:", req.body);
  try {
    const orderRef = uuid();
    const { paymentMethod } = req.body;

    const host = req.get("host");
    const protocol = req.socket.encrypted ? "https" : "http";

    const response = await checkout.PaymentsApi.payments({
      amount: { currency: "EUR", value: 1199 }, // €11.99
      countryCode: "NL",
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      reference: orderRef,
      shopperReference: SHOPPER_REFERENCE,
      shopperInteraction: "Ecommerce",
      recurringProcessingModel: "Subscription",
      enableRecurring: true,
      returnUrl: `${protocol}://${host}/result/success`,
      paymentMethod, // encrypted card data from frontend
      channel: "Web",
    });

    console.log("Payment API Response:", response);
    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, code: ${err.errorCode}`);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/* ################# CLIENT ROUTES ###################### */

app.get("/", (req, res) =>
  res.render("payment-form", {
    title: "Adyen API-only Card Payment",
    clientKey: process.env.ADYEN_CLIENT_KEY,
  })
);

app.get("/result/:type", (req, res) =>
  res.render("result", { type: req.params.type })
);

/* ################# WEBHOOK ###################### */

app.post("/api/webhooks/notifications", async (req, res) => {
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator();
  const notificationRequest = req.body;
  const notification = notificationRequest.notificationItems[0].NotificationRequestItem;

  if (!validator.validateHMAC(notification, hmacKey)) {
    console.log("Invalid HMAC signature.");
    return res.status(401).send("Invalid HMAC signature");
  }

  console.log("-- Webhook payload ------");
  console.log(notification);

  const shopperReference = notification.additionalData["recurring.shopperReference"];

  if (notification.eventCode === "RECURRING_CONTRACT" && shopperReference) {
    const recurringDetailReference =
      notification.additionalData["recurring.recurringDetailReference"];
    const paymentMethod = notification.paymentMethod;

    console.log(
      `Recurring token stored: ${recurringDetailReference} for shopper ${shopperReference}`
    );
    put(recurringDetailReference, paymentMethod, shopperReference);
  } else if (notification.eventCode === "AUTHORISATION") {
    console.log(`Payment authorised: ${notification.pspReference}`);
  } else {
    console.log(`Unhandled event: ${notification.eventCode}`);
  }

  res.status(202).send();
});

//Test if backend/server is reachable
app.post("/api/payments-test", (req, res) => {
  console.log("Body received:", req.body);
  res.json({ ok: true, body: req.body });
});

/* ################# SERVER ###################### */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`✅ Server running → http://localhost:${PORT}`)
);