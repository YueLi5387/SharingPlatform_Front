import http from "@/util/http";

// 获取文章列表
export const getArticleList = () => http.get("/api/article/get");

//获取当前登录用户文章列表
export const getUserArticleList = (userId: number) => {
  console.log("userId:", userId);

  return http.get("/my/articleinfo/getUserArticle", { params: { userId } });
};

//新增文章
export const addArticleService = (data: object) => {
  return http.post("my/articleinfo/add", data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

//搜索文章
export const searchArticleService = (str: string) => {
  return http.get("/api/article/search", { params: { keywords: str } });
};
