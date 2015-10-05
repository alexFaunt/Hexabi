import styles from './Hex.css';

import React, { Component } from 'react';

export default class Hex extends Component {

    render() {
        return <div className={styles.base} style={{
            width: this.props.width,
            marginLeft: this.props.marginLeft
        }}/>;
    }
};
