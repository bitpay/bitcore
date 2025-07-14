import {Children, FC, ReactNode} from 'react';
import {useTheme} from 'styled-components';

const DataBox: FC<{children: ReactNode, label: string, style?: object}> = ({children, label, style}) => {
  const theme = useTheme();
  const modifiedChildren = typeof children === 'object' 
    ? Children.map(children as JSX.Element, (child: JSX.Element) => {
        return <span {...child.props} style={{margin: 0}}></span>;
      })
    : children;
  
  return (
    <fieldset style={{
      border: `2.5px solid ${theme.dark ? '#5f5f5f' : '#ccc'}`,
      borderRadius: '5px',
      padding: '0.1rem 0.4rem',
      wordBreak: 'break-all',
      whiteSpace: 'normal',
      width: 'fit-content',
      height: 'fit-content',
      margin: '0.7rem 0.2rem',
      ...style
    }}>
      <legend style={{fontWeight: 'bold', color: 'gray', margin: '-0.2rem 0.1rem'}}>{label}</legend>
      {modifiedChildren}
    </fieldset>
  );
}

export default DataBox;