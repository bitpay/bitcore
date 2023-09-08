import {useState, memo} from 'react';
import styled, {useTheme} from 'styled-components';
import {motion, AnimatePresence} from 'framer-motion';
import MoonSvg from '../assets/images/moon.svg';
import SunSvg from '../assets/images/sun.svg';
import {useAppDispatch} from '../utilities/hooks';
import {changeTheme} from '../store/app.actions';
import {Black} from '../assets/styles/colors';
const DarkModeXValue = 15;
const LightModeXValue = 0;

const ThemeChangerContainer = styled.div`
  display: flex;
  align-items: center;
`;

interface SwitchProps {
  checked: boolean;
}

const Switch = styled(motion.div)<SwitchProps>`
  width: 42px;
  height: 26px;
  background: #8f00ff;
  display: flex;
  justify-content: flex-start;
  border-radius: 50px;
  padding: 3px;
  cursor: pointer;
  margin-left: 21px;
`;

const Handle = styled(motion.div)<SwitchProps>`
  width: 20px;
  height: 20px;
  background-color: ${Black};
  border-radius: 15px;
  background-image: url(${({checked}) => (checked ? MoonSvg : SunSvg)});
  background-repeat: no-repeat;
  background-size: 12px 13px;
  background-position: center;
`;

const ThemeChanger = () => {
  const theme = useTheme();
  const [checked, setChecked] = useState<boolean>(theme.dark);
  const dispatch = useAppDispatch();
  const [xValue, setXvalue] = useState(theme.dark ? DarkModeXValue : LightModeXValue);

  const onChange = (newValue: boolean) => {
    const newTheme = newValue ? 'dark' : 'light';
    dispatch(changeTheme(newTheme));
    setChecked(newValue);
    setXvalue(newTheme === 'dark' ? DarkModeXValue : LightModeXValue);
  };

  const spring = {
    type: 'spring',
    stiffness: 1000,
    damping: 30,
  };

  return (
    <ThemeChangerContainer>
      <AnimatePresence initial={false}>
        <Switch checked={checked} onClick={() => onChange(!checked)}>
          <Handle
            animate={{
              x: xValue,
            }}
            transition={spring}
            checked={checked}
          />
        </Switch>
      </AnimatePresence>
    </ThemeChangerContainer>
  );
};

export default memo(ThemeChanger);
