import { Body, Controller, Get, Post } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

@Controller()
export class PaymentsController {
  constructor(private paymentService: PaymentsService) {}

  @Get("/paymentMethods")
  postPaymentMethods(): Promise<any> {
    return this.paymentService.postForPaymentMethods();
  }

  @Post("/payments/redirect")
  postPaymentsRedirect(@Body() requestBody: any): Promise<any> {
    return this.paymentService.postForPaymentsRedirect(requestBody);
  }

  //this controller exponses the /payments/native endpoint for the frontend to call
  // and eventually calls the postForPaymentsNative function in ...3dsAuthOnly/backend/src/payments/payments.service.ts
  @Post("/payments/native")
  postPaymentsNative(@Body() requestBody: any): Promise<any> {
     console.log("Received data:", requestBody.data);
     console.log("Received url:", requestBody.url);
     // If "flow" was sent separately in the body
     console.log("Received flow (from body):", requestBody.flow);
    return this.paymentService.postForPaymentsNative(requestBody);
  }

  @Post("/sessions")
  postSessions(@Body() requestBody: any): Promise<any> {
    return this.paymentService.postForSessions(requestBody.data);
  }

  @Post("/paymentDetails")
  postPaymentDetails(@Body() requestBody: any): Promise<any> {
    return this.paymentService.postForPaymentDetails(requestBody.data);
  }

  //controller for optional Authorisation on button click
  @Post("/paymentsAuthorisation")
  postPaymentsAuthorisation(@Body() requestBody: any): Promise<any> {
    return this.paymentService.postForPaymentDetails(requestBody.data);
  }


}
