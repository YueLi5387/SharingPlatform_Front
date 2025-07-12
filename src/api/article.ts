import axios from "axios";
export const getArticleList = () => axios.get("http://localhost:8080/article/get");
