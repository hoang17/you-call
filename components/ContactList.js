import React, { Component } from 'react';

import {
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  ScrollView,
} from 'react-native';

module.exports = React.createClass({

  render(){
    var keys = this.props.contacts ? Object.keys(this.props.contacts) : [];
    if(keys.length == 0){
      return <Text>No Contacts Loaded</Text>
    }
    return (
      <ScrollView>
        {keys.map((key) => {
          var contact = this.props.contacts[key];
          contact.fullName = [contact.firstName, , contact.middleName, contact.lastName].join(' ').trim();
          return (
            <View style={{padding:5}} key={key}>
              <TouchableHighlight
                style={styles.button}
                underlayColor='#99d9f4'
                onPress={this.props.callback.bind(this, contact)}
                >
                <Text style={styles.buttonText}>{contact.fullName} ({contact.number.substr(contact.number.length-4)})</Text>
              </TouchableHighlight>
            </View>
          )
        })}
      </ScrollView>
    )
  }
});

const styles = StyleSheet.create({
	buttonText: {
	  fontSize: 18,
	  color: 'white',
	  alignSelf: 'center'
	},
	button: {
	  height: 36,
	  flex: 1,
	  flexDirection: 'row',
	  backgroundColor: '#48BBEC',
	  borderColor: '#48BBEC',
	  borderWidth: 1,
	  borderRadius: 2,
	  alignSelf: 'stretch',
	  justifyContent: 'center'
	},
});
