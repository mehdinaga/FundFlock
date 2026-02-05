import 'dotenv/config';

export default {
  expo: {
    name: "FundFlock",
    slug: "fundflock",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "fundflock",
    extra: {
      apiUrl: process.env.API_URL || "http://localhost:3000/api/v1",
    },
  },
};
