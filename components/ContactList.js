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
    if(this.props.contacts.lengh == 0){
      return <Text>No Contacts Loaded</Text>
    }
    return (
      <ScrollView>
        <Text style={{marginTop:-70}}></Text>
        {this.props.contacts.map((contact) => {
          if (contact.phoneNumbers.length == 0 || contact.phoneNumbers.length > 10) {
            return
          }
          var fullName = '';
          if (firstName = contact.firstName) {
              fullName += firstName;
          }
          if (lastName = contact.lastName) {
              if (fullName) {
                  fullName += ' ';
              }
              fullName += lastName;
          }
          contact.fullName = fullName;
          return (
            <View style={{padding:5}} key={contact.recordID}>
              <TouchableHighlight
                style={styles.button}
                underlayColor='#99d9f4'
                onPress={this.props.callback.bind(this, contact)}
                >
                <Text style={styles.buttonText}>{fullName}</Text>
                {/*{contact.phoneNumbers.map((e) => {
                  return (
                      <Text key={e.number} style={styles.buttonText}>{e.label}: {e.number}</Text>
                  )
                })}*/}
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
