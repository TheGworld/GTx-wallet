import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Button from '../../../../components/ui/button';

export default class TokenListPlaceholder extends Component {
  static contextTypes = {
    t: PropTypes.func,
  };

  render() {
    return (
      <div className="token-list-placeholder">
        <img src="images/tokensearch.svg" />
        <div className="token-list-placeholder__text">
          {this.context.t('addAcquiredTokens')}
        </div>
        <Button
          type="link"
          className="token-list-placeholder__link"
          href="https://docs.gtx.io/en-us/articles/360015489031"
          target="_blank"
          rel="noopener noreferrer"
        >
          {this.context.t('learnMore')}
        </Button>
      </div>
    );
  }
}
