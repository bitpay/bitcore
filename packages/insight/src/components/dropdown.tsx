import { FC, CSSProperties } from 'react';
import ArrowDown from '../assets/images/arrow-down.svg';
import { useTheme } from 'styled-components';

const Dropdown: FC<{
  options: string[],
  value?: string,
  onChange?: (value: string) => void,
  style?: CSSProperties
}> = ({options, value, onChange, style}) => {
  const theme = useTheme();
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '120px', ...style }}>
      <select
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        style={{
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          fontSize: '1rem',
          background: theme.dark ? '#aaa' : '#fff',
          width: '100%',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
        }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <img
        src={ArrowDown}
        alt="Arrow Down"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '30px',
          height: '30px'
        }}
      />
    </div>
  );
}

export default Dropdown;