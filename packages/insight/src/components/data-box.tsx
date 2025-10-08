import {Children, CSSProperties, FC, ReactNode} from 'react';
import styled from 'styled-components';

const DataBox: FC<{
  children: ReactNode, 
  label?: string, 
  style?: CSSProperties, 
  centerLabel?: boolean,
  colorDark?: string,
  colorLight?: string}> = ({children, label, style, centerLabel, colorDark='#5f5f5f', colorLight='#ccc'}) => {
  const modifiedChildren = typeof children === 'object' 
    ? Children.map(children as JSX.Element, (child: JSX.Element) => {
        return <span {...child.props} style={{margin: 0}}></span>;
      })
    : children;

  const DataBoxFieldset = styled.fieldset`
    border: 2.5px solid ${({theme: {dark}}) => dark ? colorDark : colorLight};
    border-radius: 5px;
    padding: 0.1rem 0.4rem;
    wordBreak: break-all;
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
      {modifiedChildren}
    </DataBoxFieldset>
  );
}

export default DataBox;