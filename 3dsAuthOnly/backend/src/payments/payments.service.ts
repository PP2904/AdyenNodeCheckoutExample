import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuid } from "uuid";
import { Client, CheckoutAPI } from "@adyen/api-library";
import {
  PaymentMethodsResponse,
  PaymentResponse,
  PaymentRequest,
  AuthenticationData,
  ThreeDSRequestData,
  PaymentDetailsResponse,
  PaymentCompletionDetails,
  CreateCheckoutSessionResponse,
  CreateCheckoutSessionRequest,
} from "@adyen/api-library/lib/src/typings/checkout/models";
import { PaymentsApi } from "@adyen/api-library/lib/src/services/checkout/paymentsApi";

@Injectable()
export class PaymentsService {
  private API_KEY: string;
  private MERCHANT_ACCOUNT: string;
  private paymentsAPI: PaymentsApi;

  constructor(private configService: ConfigService) {
    this.API_KEY = this.configService.get<string>("ADYEN_API_KEY");
    this.MERCHANT_ACCOUNT = this.configService.get<string>("ADYEN_MERCHANT_ACCOUNT");

    const client: Client = new Client({
      apiKey: this.API_KEY,
      environment: "TEST",
    });

    this.paymentsAPI = new CheckoutAPI(client).PaymentsApi;
  }

  async postForPaymentMethods(): Promise<PaymentMethodsResponse> {
    console.log("postForPaymentMethods called")
    const postData = {
      merchantAccount: this.MERCHANT_ACCOUNT,
      //why are changes here not reflected?
      //shopperConversionId: "shopper123"
    };

    return await this.paymentsAPI.paymentMethods(postData);
  }

  /**
   * Handle native payments using full frontend data, with fallbacks.
   */
  //gets called by the postDoPayment() in the frontend via the controller
  async postForPaymentsNative({ data, url }): Promise<PaymentResponse> {
    console.log("postForPaymentsNative called")
    const reference = uuid();

    const authenticationData: AuthenticationData = {
      threeDSRequestData: {
        challengeWindowSize: ThreeDSRequestData.ChallengeWindowSizeEnum._05,
        nativeThreeDS: ThreeDSRequestData.NativeThreeDSEnum.Preferred,
      },
      authenticationOnly: true,
    };

    const paymentRequestData: PaymentRequest = {
      ...data, // Spread full frontend payload (browserInfo, paymentMethod, shopperName, etc.)

      //these fields are added in the backend
      reference,
      returnUrl: url,
      origin: url,
      merchantAccount: this.MERCHANT_ACCOUNT,
      //authenticationData overrides the data sent from FE
      authenticationData,
      shopperConversionId: `shopper123`,
          metaData: {
            testData: `1234`
          },

      // Fallbacks
      amount: data.amount || { currency: "EUR", value: 1000 },
      channel: data.channel || PaymentRequest.ChannelEnum.Web,
    };
    console.log("postForPaymentsNative called and the data: ",data)
    console.log("postForPaymentsNative called and the payload: ",paymentRequestData)

    return await this.paymentsAPI.payments(paymentRequestData);
  }


 /** AUTHORISATION BUTTON 
   * Handle native payment; using full frontend data
   */
  async postPaymentsAuthorisation({ data, url }): Promise<PaymentResponse> {
    console.log("postPaymentsAuthorisation called")
    console.log("the data obj: ", data)
    const pspDetails = data.metaData.pspRefFromDetails;
    const reference = `AuthOnlyAuthorisation_${pspDetails}`;

    const paymentAuthorisationRequestData: PaymentRequest = {
      ...data, // Spread full frontend payload (browserInfo, paymentMethod, shopperName, etc.)

      //these fields are added in the backend
      reference,
      returnUrl: url,
      origin: url,
      merchantAccount: this.MERCHANT_ACCOUNT,
      //authenticationData overrides the data sent from FE
      authenticationData:{
        attemptAuthentication:'never',
      },
      shopperConversionId: `shopper123`,
      metaData: {
            testData: `1234`
          },

      // Fallbacks
      amount: data.amount || { currency: "EUR", value: 1000 },
      channel: data.channel || PaymentRequest.ChannelEnum.Web,
    };  

    return await this.paymentsAPI.payments(paymentAuthorisationRequestData);
  }

    /**
   * Handle native payments using full frontend data, with fallbacks.
   */
   /*  async postForPaymentsAuthorisationNative({ data, url }): Promise<PaymentResponse> {
     //tbd
    } */

  /**
   * Handle redirect-based payments (3DS2 default flow).
   */
  async postForPaymentsRedirect({ data, url }): Promise<PaymentResponse> {
    const reference = uuid();

    const paymentRequestData: PaymentRequest = {
      ...data,

      reference,
      returnUrl: url,
      origin: url,
      merchantAccount: this.MERCHANT_ACCOUNT,

      amount: data.amount || { currency: "EUR", value: 1000 },
      channel: data.channel || PaymentRequest.ChannelEnum.Web,
    };

    return await this.paymentsAPI.payments(paymentRequestData);
  }

  /**
   * Handle /payments/details for 3DS authentication step.
   */
  async postForPaymentDetails({ details }: { details: PaymentCompletionDetails }): Promise<PaymentDetailsResponse> {
    console.log("postForPaymentDetails called")
    return await this.paymentsAPI.paymentsDetails({ details });
  }

  /**
   * Handle /sessions flow (Drop-in).
   */
  async postForSessions({ url }): Promise<CreateCheckoutSessionResponse> {
    const reference = uuid();

    const sessionsRequestData: CreateCheckoutSessionRequest = {
      amount: {
        currency: "EUR",
        value: 1000,
      },
      countryCode: "NL",
      shopperName: {
        firstName: "Test",
        lastName: "Shopper",
      },
      telephoneNumber: "0612345678",
      billingAddress: {
        houseNumberOrName: "1",
        street: "Shopper Billing Street",
        city: "Amsterdam",
        country: "NL",
        postalCode: "1234AB",
      },
      deliveryAddress: {
        houseNumberOrName: "1",
        street: "Shopper Delivery Street",
        city: "Amsterdam",
        country: "NL",
        postalCode: "1234AB",
      },
      shopperIP: "http://192.0.2.1/",
      shopperEmail: "test@adyen.com",
      channel: PaymentRequest.ChannelEnum.Web,
      reference: reference,
      returnUrl: url,
      merchantAccount: this.MERCHANT_ACCOUNT,
    };

    return await this.paymentsAPI.sessions(sessionsRequestData);
  }
}