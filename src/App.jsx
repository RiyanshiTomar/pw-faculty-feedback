import { useState } from 'react';
import LoginScreen       from './components/LoginScreen';
import WelcomeScreen     from './components/WelcomeScreen';
import FeedbackForm      from './components/FeedbackForm';
import ThankYouScreen    from './components/ThankYouScreen';
import BatchExpiredScreen from './components/BatchExpiredScreen';
import CooldownScreen    from './components/CooldownScreen';
import './styles/global.css';

export default function App() {
  const [screen,   setScreen]   = useState('login');    // login | welcome | feedback | thankyou | expired | cooldown
  const [student,  setStudent]  = useState(null);
  const [faculties,setFaculties]= useState([]);
  const [expiredReason, setExpiredReason] = useState('');
  const [cooldownInfo,  setCooldownInfo]  = useState(null);

  function handleValidated(s, f) {
    setStudent(s); setFaculties(f);
    setScreen('welcome');
  }
  function handleBatchExpired(s, reason) {
    setStudent(s); setExpiredReason(reason);
    setScreen('expired');
  }
  function handleCooldown(s, info) {
    setStudent(s); setCooldownInfo(info);
    setScreen('cooldown');
  }
  function handleReset() {
    setStudent(null); setFaculties([]); setExpiredReason(''); setCooldownInfo(null);
    setScreen('login');
  }

  return (
    <>
      {screen === 'login'    && (
        <LoginScreen
          onValidated={handleValidated}
          onBatchExpired={handleBatchExpired}
          onCooldown={handleCooldown}
        />
      )}
      {screen === 'welcome'  && <WelcomeScreen  student={student} faculties={faculties} onStart={() => setScreen('feedback')} onBack={handleReset} />}
      {screen === 'feedback' && <FeedbackForm   student={student} faculties={faculties} onSubmitted={() => setScreen('thankyou')} onBack={() => setScreen('welcome')} />}
      {screen === 'thankyou' && <ThankYouScreen onReset={handleReset} />}
      {screen === 'expired'  && <BatchExpiredScreen student={student} reason={expiredReason} onBack={handleReset} />}
      {screen === 'cooldown' && (
        <CooldownScreen
          student={student}
          lastSubmittedAt={cooldownInfo?.lastSubmittedAt}
          nextEligibleDate={cooldownInfo?.nextEligibleDate}
          onBack={handleReset}
        />
      )}
    </>
  );
}
