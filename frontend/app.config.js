import 'dotenv/config';

export default {
  expo: {
    name: "FundFlock",
    slug: "fundflock",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "fundflock",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fundflock.app",
    },
    android: {
      package: "com.fundflock.app",
    },
    plugins: [
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.fundflock",
          enableGooglePay: true,
        },
      ],
    ],
    extra: {
      apiUrl: process.env.API_URL || "http://localhost:3000/api/v1",
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    },
  },
};
