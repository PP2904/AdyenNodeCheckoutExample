import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import pkg from "@adyen/api-library";
const { Client, Config, CheckoutAPI } = pkg;

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Setup Adyen config
const config = new Config();
config.apiKey = process.env.ADYEN_API_KEY;

if (process.env.ADYEN_ENVIRONMENT === "LIVE") {
  if (!process.env.ADYEN_PREFIX) {
    throw new Error("ADYEN_PREFIX must be set for live environment");
  }
  config.environment = "LIVE";  // <-- important to set explicitly for live
  config.checkoutEndpoint = `https://${process.env.ADYEN_PREFIX}-checkout-live.adyenpayments.com/checkout`;
} else {
  config.environment = "TEST";
}

// Create Adyen client and Checkout API instance
const client = new Client({ config });
const checkout = new CheckoutAPI(client);

const MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT;

// Log environment variables for debugging
console.log("API Key Loaded:", !!process.env.ADYEN_API_KEY);
console.log("Merchant Account:", MERCHANT_ACCOUNT);
console.log("Environment:", process.env.ADYEN_ENVIRONMENT);
console.log("Prefix:", process.env.ADYEN_PREFIX);

// Routes

app.post("/api/getPaymentMethods", async (req, res) => {
  try {
    const paymentMethodsRequest = {
      merchantAccount: MERCHANT_ACCOUNT,
      countryCode: "NL", // Change based on your use case
      amount: {
        currency: "EUR",
        value: 1000, // minor units
      },
      channel: "Web",
    };

    const response = await checkout.paymentMethods(paymentMethodsRequest);
    res.json(response);
  } catch (err) {
    console.error("getPaymentMethods error:", err.response?.data || err.message || err);
    res.status(500).json({ message: "Error fetching payment methods" });
  }
});

app.post("/api/initiatePayment", async (req, res) => {
  try {
    const { paymentMethod, browserInfo, billingAddress } = req.body;

    const paymentRequest = {
      merchantAccount: MERCHANT_ACCOUNT,
      amount: {
        currency: "EUR",
        value: 1000,
      },
      reference: "YOUR_ORDER_NUMBER",
      paymentMethod,
      browserInfo,
      billingAddress,
      returnUrl: "http://localhost:3000/checkout?shopperOrder=12345",
      channel: "Web",
    };

    const response = await checkout.payments(paymentRequest);
    res.json(response);
  } catch (err) {
    console.error("initiatePayment error:", err.response?.data || err.message || err);
    res.status(500).json({ message: "Payment initiation failed" });
  }
});

app.post("/api/submitAdditionalDetails", async (req, res) => {
  try {
    const detailsRequest = {
      details: req.body.details,
      paymentData: req.body.paymentData,
    };

    const response = await checkout.paymentsDetails(detailsRequest);
    res.json(response);
  } catch (err) {
    console.error("submitAdditionalDetails error:", err.response?.data || err.message || err);
    res.status(500).json({ message: "Error submitting additional details" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});