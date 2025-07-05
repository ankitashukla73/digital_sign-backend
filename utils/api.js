import axios from "axios";

const API = axios.create({
  baseURL: "https://relaxed-eclair-42da2d.netlify.app/api", // change if deployed
});

export default API;
