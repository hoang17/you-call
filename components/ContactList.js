import React, { Component } from 'react';

import {
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  ScrollView,
} from 'react-native';

import Button from 'apsl-react-native-button'

module.exports = React.createClass({

  render(){
    var keys = this.props.contacts ? Object.keys(this.props.contacts) : [];
    if(keys.length == 0){
      return (
        <Button
          onPress={this.props.syncContacts}
          style={styles.buttonStyle8}
          textStyle={styles.textStyle8}>
          Sync contacts
        </Button>
      )
    }
    return (
      <ScrollView>
        {keys.map((key) => {
          var contact = this.props.contacts[key];
          if (!contact.fullName) contact.fullName = [contact.firstName, , contact.middleName, contact.lastName].join(' ').trim();
          return (
            <Button key={key}
              onPress={this.props.call.bind(this, key)}
              style={styles.buttonStyle8}
              textStyle={styles.textStyle8}>
              {contact.fullName}
            </Button>
          )
        })}
      </ScrollView>
    )
  }
});

const styles = StyleSheet.create({
  buttonStyle8: {
    backgroundColor: 'white',
    borderColor: '#333',
    borderWidth: 2,
    borderRadius: 22,
  },
  textStyle8: {
    fontFamily: 'Avenir Next',
    fontWeight: '500',
    color: '#333',
  },

	// buttonText: {
	//   fontSize: 18,
	//   color: 'white',
	//   alignSelf: 'center'
	// },
	// button: {
	//   height: 36,
	//   flex: 1,
	//   flexDirection: 'row',
  //   borderColor: '#27ae60',
  //   backgroundColor: '#2ecc71',
	//   // backgroundColor: '#48BBEC',
	//   // borderColor: '#48BBEC',
	//   borderWidth: 1,
	//   borderRadius: 2,
	//   alignSelf: 'stretch',
	//   justifyContent: 'center'
	// },
});
