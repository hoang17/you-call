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
    if(this.props.contacts.lengh === 0){
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
          return (
            <View style={{backgroundColor: 'rgba(0,0,0,.1)', margin: 5, padding:5,}} key={contact.recordID}>
              <Text>{fullName}</Text>
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
})
