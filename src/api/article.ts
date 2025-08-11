import axios from "axios";
import http from "@/util/http";

export const getArticleList = () => axios.get("/api/article/get");

//新增文章
export const addArticleService = (data: object) => {
  return http.post("my/articleinfo/add", data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
