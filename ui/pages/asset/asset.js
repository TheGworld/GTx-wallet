import React from 'react';
import { useSelector } from 'react-redux';
import { Redirect, useParams } from 'react-router-dom';
import { THETA_SYMBOL } from '../../../app/scripts/controllers/network/enums';
import { getTokens } from '../../ducks/metamask/metamask';
import { DEFAULT_ROUTE } from '../../helpers/constants/routes';

import NativeAsset from './components/native-asset';
import TokenAsset from './components/token-asset';

const Asset = () => {
  const nativeCurrency = useSelector((state) => state.metamask.nativeCurrency);
  const tokens = useSelector(getTokens);
  const { asset } = useParams();

  const token = tokens.find(({ address }) => address === asset);

  let content;
  if (token) {
    content = <TokenAsset token={token} />;
  } else if (asset === nativeCurrency || asset === THETA_SYMBOL) {
    content = <NativeAsset nativeCurrency={asset} />;
  } else {
    content = <Redirect to={{ pathname: DEFAULT_ROUTE }} />;
  }
  return <div className="main-container asset__container">{content}</div>;
};

export default Asset;
