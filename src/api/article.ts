import axios from "axios";
export const getArticleList = () => axios.get("http://localhost:3000/article");
