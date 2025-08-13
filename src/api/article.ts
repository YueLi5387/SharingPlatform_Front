import http from "@/util/http";

// 获取文章列表
export const getArticleList = () => http.get("/api/article/get");

//新增文章
export const addArticleService = (data: object) => {
  return http.post("my/articleinfo/add", data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
