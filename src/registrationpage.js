import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      alert('Invalid verification link.');
      return;
    }

    
    fetch(`http://localhost:3001/api/verify-token?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          
          navigate('/get-started', { state: { verificationToken: token } });
        } else {
          alert('Verification token is invalid or expired.');
        }
      });
  }, []);
  
  return <p>Verifying...</p>;
}
