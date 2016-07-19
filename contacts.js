import React, { Component } from 'react';

import {
  AppRegistry,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  ScrollView,
} from 'react-native';

var ContactList = require('./components/ContactList')
import AddressBook from 'react-native-addressbook'

var AddressbookDemo = React.createClass({
  getInitialState() {
    AddressBook.getContacts( (err, contacts) => {
      console.log('GET CONTACTS', err, contacts)
      if(err && err.type === 'permissionDenied'){
        // x.x
      }
      else{
        this.setState({contacts: contacts})
      }
    })

    return {
      contacts: [],
    }
  },

  checkPermission(){
    AddressBook.checkPermission( (err, permission) => {
      console.log('CHECK PERMISSION', err, permission)
    })
  },

  render: function() {
    return (
      <View style={styles.container}>
        {/*<TouchableHighlight style={styles.button} onPress={this.checkPermission}><Text>Check Permissions</Text></TouchableHighlight>*/}
        <ContactList contacts={this.state.contacts} />
      </View>
    );
  }
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
    padding:20,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,1)',
  },
  note: {
    fontSize:20,
    fontWeight:'bold',
  },
  button: {
    backgroundColor: '#48BBEC',
	  borderColor: '#48BBEC',
	  borderWidth: 1,
	  borderRadius: 4,
    padding:5,
    borderRadius:3,
    borderWidth:1,
    margin: 5,
  },
});

AppRegistry.registerComponent('AddressbookDemo', () => AddressbookDemo);
