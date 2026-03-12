import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/results", { replace: true });
  }, [navigate]);

  return null;
};

export default Profile;
