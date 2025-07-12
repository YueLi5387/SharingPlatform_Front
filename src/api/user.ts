import axios from "axios";
export const addUser = (data:object)=>{
  console.log(data);
  return axios.post('http://localhost:8080/user/addUser',data)
}