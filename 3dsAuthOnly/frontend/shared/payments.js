//paymentMethods call
export const getPaymentMethods = async () => {
  console.log("Do /paymentMethods GET request");
  const paymentMethodUrl = `/api/paymentMethods`;
  const response = await fetch("/api/paymentMethods");

  //how would shopperConversionId work with paymentMethods call?
  //A: defining it on the backend (payments.service.ts)

  return await response.json();
};

//payments call for Auth-only
//postDoPayment is calling @Post("/payments/native") in ...3dsAuthOnly/backend/src/payments/payments.controller.ts
export const postDoPayment = async (data, { url, flow }) => {
  const paymentsUrl = `/api/payments/${flow}`;

  //console.log(`Do ${paymentsUrl} POST request with: ${data}`);
  console.log(`Do ${paymentsUrl} POST request to: ${paymentsUrl}`);
  console.log("Request data payload:", data);

  const requestBody = { data, url };
  const clonedRequestBody = JSON.parse(JSON.stringify(requestBody)); // Clone the object
console.log("Cloned Payment Request Body:", clonedRequestBody.data); // Logs the static snapshot
//console.dir("console.dir: ", clonedRequestBody.data); // Logs it in an expandable format
console.dir(clonedRequestBody.data, { depth: null });

  const response = await fetch(paymentsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  return await response.json();
};

//payments call for authorisatoin
//postDoPaymentAuthorisation is calling @Post("/paymentsAuthorisation") in ...3dsAuthOnly/backend/src/payments/payments.controller.ts
export const postDoPaymentAuthorisation = async (data, { url, flow }) => {
  const paymentsUrl = `/api/paymentsAuthorisation`;

  //console.log(`Do ${paymentsUrl} POST request with: ${data}`);
  console.log(`Do ${paymentsUrl} POST request to: ${paymentsUrl}`);
  console.log("Request data payload:", data);

  const requestBody = { data, url };
  const clonedRequestBody = JSON.parse(JSON.stringify(requestBody)); // Clone the object
console.log("Cloned Payment Request Body:", clonedRequestBody.data); // Logs the static snapshot
//console.dir("console.dir: ", clonedRequestBody.data); // Logs it in an expandable format
console.dir(clonedRequestBody.data, { depth: null });

  const response = await fetch(paymentsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  return await response.json();
};

//paymentsDetails call
export const postDoPaymentDetails = async (data) => {
  console.log(`Do /payments/details POST request with: ${data}`);
  const response = await fetch("/api/paymentDetails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  return await response.json();
};

export const postDoSessions = async (data) => {
  console.log("Do /sessions request with: ", data);
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  return await response.json();
};
