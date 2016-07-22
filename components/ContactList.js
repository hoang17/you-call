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
          if (contact.phoneNumbers.length == 0 || contact.phoneNumbers.length > 10) {
            return
          }
          contact.fullName = [contact.firstName, contact.lastName].join(' ');
          return (
            <View style={{padding:5}} key={key}>
              <TouchableHighlight
                style={styles.button}
                underlayColor='#99d9f4'
                onPress={this.props.callback.bind(this, contact)}
                >
                <Text style={styles.buttonText}>{contact.fullName} ({contact.phone.substr(contact.phone.length-4)})</Text>
              </TouchableHighlight>
              {contact.phoneNumbers.map((e) => {
                return (
                    <Text key={e.number}>{e.label}: {e.number}</Text>
                )
              })}
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
