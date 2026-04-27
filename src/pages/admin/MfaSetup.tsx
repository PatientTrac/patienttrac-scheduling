import { useNavigate } from 'react-router-dom'

export default function MfaSetup() {
  const navigate = useNavigate()
  // MFA setup is now handled inline in AdminLogin
  // This component redirects to login
  navigate('/admin/login')
  return null
}
