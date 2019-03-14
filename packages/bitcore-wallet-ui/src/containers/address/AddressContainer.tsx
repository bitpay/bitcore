import React from 'react';
import PropTypes from 'prop-types';
import { withStyles, Theme, createStyles } from '@material-ui/core/styles';
import { AppState } from '../../types/state';
import { connect } from 'react-redux';
import { AddressList } from '../../components/address/AddressList';

const styles = (theme: Theme) =>
  createStyles({
    root: {
      marginTop: '21em',
      background: 'rgba(0,0,0,.07)',
      padding: 0,
      width: '100%'
    },
    root2: {
      paddingLeft: 0,
      paddingRight: 0,
      backgroundColor: '#1A3A8B',
      color: 'white',
      marginTop: '.8em',
      marginBottom: '5em'
    },
    padding: {
      padding: 20,
      margin: 'auto',
      maxWidth: 600,
      marginBottom: 80
    },
    listRoot: {
      flexGrow: 1,
      maxWidth: 600
    },
    demo: {
      backgroundColor: theme.palette.background.paper
    }
  });

interface Props {
  classes: any;
  addresses: AppState['addresses'];
}

function AddressCard(props: Props) {
  const { classes, addresses } = props;

  return (
    <div className={classes.padding}>
      <div className={classes.root}>
        <div className={classes.listRoot}>
          {addresses
            .slice(0)
            .reverse()
            .map((address: string, i: number) => (
              <AddressList key={i} address={address} />
            ))}
        </div>
      </div>
    </div>
  );
}

AddressCard.propTypes = {
  classes: PropTypes.object.isRequired
};

const mapStateToProps = (state: AppState) => {
  return {
    addresses: state.addresses
  };
};

export const AddressListCard = withStyles(styles)(
  connect(mapStateToProps)(AddressCard)
);
