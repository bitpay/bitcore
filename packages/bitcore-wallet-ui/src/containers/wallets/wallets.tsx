import React, { Component } from 'react';
import { Wallet, Storage } from 'bitcore-client';
import { NavBar } from './AppBar';
import { WalletListCard } from './WalletContainer';
import TextField from '@material-ui/core/TextField';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';

const API_URL =
  process.env.CREATE_REACT_APP_API_URL || 'http://localhost:3000/api';

interface Props {
  classes: any;
  styles: any;
}
interface State {
  creating: boolean;
  selectedChain: string;
  selectedNetwork: string;
  newWalletName: string;
  newWalletPassword: string;
  mnemonic?: string;
  wallet?: Wallet;
  wallets: Wallet[];
}

const styles = (theme: any) => ({
  container: {
    display: 'flex',
    flexWrap: 'wrap'
  } as any,
  textField: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    width: '90%'
  } as any,
  dense: {
    marginTop: 19
  } as any,
  menu: {
    width: 200
  } as any
});

class WalletsContainer extends Component<Props, State> {
  state: State = {
    creating: false,
    wallets: [],
    newWalletName: '',
    newWalletPassword: '',
    selectedChain: 'BTC',
    selectedNetwork: 'mainnet'
  };
  constructor(props: Props) {
    super(props);
    this.handleChainChange = this.handleChainChange.bind(this);
    this.handleNetworkChange = this.handleNetworkChange.bind(this);
    this.handleWalletNameChange = this.handleWalletNameChange.bind(this);
    this.handleWalletPasswordChange = this.handleWalletPasswordChange.bind(
      this
    );
    this.handleWalletMnemonicChange = this.handleWalletMnemonicChange.bind(
      this
    );
    this.handleCreateWalletClick = this.handleCreateWalletClick.bind(this);
    this.walletCreateComponent = this.walletCreateComponent.bind(this);
  }

  async componentDidMount() {
    const wallet = await this.createOrLoadWallet();
    this.setState({ wallet });
    const wallets = this.state.wallet!.storage.listWallets();
    this.state.wallet!.storage.listWallets().on('data', (walletBuf: Buffer) => {
      const walletStr = walletBuf.toString();
      const foundWallet = JSON.parse(walletStr);
      this.setState({ wallets: [...this.state.wallets, foundWallet] });
      console.log(foundWallet);
    });
  }

  addWalletToState(wallet: Wallet) {
    this.setState({ wallets: [...this.state.wallets, wallet] });
  }

  async createOrLoadWallet() {
    const testWallet = {
      name: 'BitcoreWallet',
      chain: 'BTC',
      network: 'regtest',
      baseUrl: API_URL,
      password: 'iamsatoshi'
    };
    let wallet: Wallet | undefined;
    try {
      const exists = await Wallet.exists(testWallet);
      if (!exists) {
        console.log('Wallet needs to be created');
        wallet = await Wallet.create(testWallet);
      } else {
        console.log('Wallet exists');
        wallet = await Wallet.loadWallet(testWallet);
      }
    } catch (err) {
      console.log(err);
    }
    return wallet;
  }

  handleChainChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ selectedChain: event.target.value as string });
  }

  handleNetworkChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ selectedNetwork: event.target.value as string });
  }

  async handleCreateWalletClick() {
    const wallet = await Wallet.create({
      name: this.state.newWalletName,
      password: this.state.newWalletPassword,
      chain: this.state.selectedChain,
      network: this.state.selectedNetwork,
      phrase: this.state.mnemonic,
      baseUrl: API_URL
    });
    this.addWalletToState(wallet);
  }

  handleWalletNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newWalletName: event.target.value });
  }

  handleWalletPasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newWalletPassword: event.target.value });
  }

  handleWalletMnemonicChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ mnemonic: event.target.value });
  }
  walletCreateComponent() {
    const options = [
      { key: 'BTC', text: 'Bitcoin', value: 'BTC' },
      { key: 'BCH', text: 'Bitcoin Cash', value: 'BCH' },
      { key: 'ETH', text: 'Ethereum', value: 'ETH' }
    ];
    const chainNetworks: {
      [chain: string]: { key: string; text: string; value: string }[];
    } = {
      BTC: [
        { key: 'mainnet', text: 'Mainnet', value: 'mainnet' },
        { key: 'testnet', text: 'Testnet', value: 'testnet' },
        { key: 'regtest', text: 'Regtest', value: 'regtest' }
      ],
      BCH: [
        { key: 'mainnet', text: 'Mainnet', value: 'mainnet' },
        { key: 'testnet', text: 'Testnet', value: 'testnet' },
        { key: 'regtest', text: 'Regtest', value: 'regtest' }
      ],
      ETH: [{ key: 'mainnet', text: 'Mainnet', value: 'mainnet' }]
    };
    const networks = chainNetworks[this.state.selectedChain] || [];
    return (
      <div className="walletCreateContainer">
        <TextField
          id="standard-dense"
          label="Wallet Name"
          className={classNames(
            this.props.classes.textField,
            this.props.classes.dense
          )}
          margin="dense"
          required
          onChange={this.handleWalletNameChange}
        />
        <TextField
          id="standard-dense"
          label="Wallet Password"
          className={classNames(
            this.props.classes.textField,
            this.props.classes.dense
          )}
          margin="dense"
          onChange={this.handleWalletPasswordChange}
        />

        <TextField
          id="standard-dense"
          label="Mnemonic"
          className={classNames(
            this.props.classes.textField,
            this.props.classes.dense
          )}
          margin="dense"
          onChange={this.handleWalletMnemonicChange}
        />

        <TextField
          id="standard-select-chain"
          select
          label="Chain"
          className={this.props.classes.textField}
          value={this.state.selectedChain}
          onChange={this.handleChainChange}
          required
          SelectProps={{
            MenuProps: {
              className: this.props.classes.menu
            }
          }}
          helperText="Please select your chain"
          margin="normal"
        >
          {options.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.text}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          id="standard-select-network"
          select
          label="Network"
          className={this.props.classes.textField}
          value={this.state.selectedNetwork}
          onChange={this.handleNetworkChange}
          required
          SelectProps={{
            MenuProps: {
              className: this.props.classes.menu
            }
          }}
          helperText="Please select your network"
          margin="normal"
        >
          {networks.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.text}
            </MenuItem>
          ))}
        </TextField>
      </div>
    );
  }

  render() {
    return (
      <div className="walletContainer">
        <NavBar />
        <WalletListCard
          wallets={this.state.wallets}
          walletCreate={this.walletCreateComponent}
          handleCreateWalletClick={this.handleCreateWalletClick}
        />
      </div>
    );
  }
}

const WalletsContainers = withStyles(styles)(WalletsContainer);

export { WalletsContainers };
