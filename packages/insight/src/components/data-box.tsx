import {CSSProperties, FC, ReactNode} from 'react';
import styled from 'styled-components';

const DataBox: FC<{
  children: ReactNode, 
  label?: string, 
  style?: CSSProperties, 
  centerLabel?: boolean,
  colorDark?: string,
  colorLight?: string}> = ({children, label, style, centerLabel, colorDark='#5f5f5f', colorLight='#ccc'}) => {

  const DataBoxFieldset = styled.fieldset`
    border: 2.5px solid ${({theme: {dark}}) => dark ? colorDark : colorLight};
    border-radius: 5px;
    padding: 0.1rem 0.4rem;
    word-break: break-all;
    white-space: normal;
    width: fit-content;
    height: fit-content;
    margin: 0.7rem 0.2rem;
  `;

  return (
    <DataBoxFieldset style={style}>
      { label && 
        <legend
          style={{
            fontWeight: 'bold',
            color: 'gray',
            margin: '-0.2rem 0.1rem',
            textAlign: centerLabel ? 'center' : 'left',
          }}
        >
          {label}
        </legend>
      }
      {children}
    </DataBoxFieldset>
  );
}

export default DataBox;