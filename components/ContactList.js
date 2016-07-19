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
            <View style={{borderWidth:1, borderColor: 'rgba(0,0,0,.1)', margin: 5, padding:5}} key={contact.recordID} onPress={this.props.callback}>
              <Text style={{padding:5, fontSize:18}}>{fullName}</Text>
              {contact.phoneNumbers.map((e) => {
                return (
                  <TouchableHighlight style={styles.button}
                      underlayColor='#99d9f4'
                      onPress={this._press}
                      key={e.number}
                      >
                    <Text style={styles.buttonText}>{e.label}: {e.number}</Text>
                  </TouchableHighlight>

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
  outerContainer: {
    flex: 1,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    flex:1
  },
  flowRight: {
	  flexDirection: 'row',
	  alignItems: 'center',
	  alignSelf: 'stretch'
	},
  contacts: {
    alignSelf: 'stretch',
    height:300,
    borderWidth:1,
    borderColor: '#48BBEC',
    borderRadius: 4,
  },
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
	  borderRadius: 4,
	  marginBottom: 10,
	  alignSelf: 'stretch',
	  justifyContent: 'center'
	},
});
