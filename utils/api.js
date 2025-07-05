import axios from "axios";

const API = axios.create({
  baseURL: "https://signetflow.netlify.app'/api", // change if deployed
});

export default API;
