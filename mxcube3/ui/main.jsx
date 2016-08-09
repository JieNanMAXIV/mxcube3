import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, IndexRoute } from 'react-router';
import SampleViewContainer from './containers/SampleViewContainer';
import SampleGridContainer from './containers/SampleGridContainer';
import LoginContainer from './containers/LoginContainer';
import LoggerContainer from './containers/LoggerContainer';
import Main from './components/Main';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import createLogger from 'redux-logger';
import thunk from 'redux-thunk';
import rootReducer from './reducers';
import ServerIO from './serverIO';
import 'font-awesome-webpack';
import { getLoginInfo } from './actions/login';
require('file?name=[name].[ext]!index.html');

const store = createStore(rootReducer, applyMiddleware(thunk, createLogger()));

if (module.hot) {
  // Enable Webpack hot module replacement for reducers
  module.hot.accept('./reducers', () => {
    const nextReducer = require('./reducers');
    store.replaceReducer(nextReducer);
  });
}

function requireAuth(nextState, replace) {
  if (!store.getState().login.loggedIn) {
    replace(null, '/login');
  }
}

export default class App extends React.Component {

  componentWillMount() {
    this.serverIO = new ServerIO(store.dispatch);
    this.serverIO.listen();
    store.dispatch(getLoginInfo());
  }

  render() {
    return (<Provider store={store}>
            <Router>
              <Route path="/" component={Main} onEnter={requireAuth}>
               <IndexRoute component={SampleGridContainer} onEnter={requireAuth} />
               <Route path="datacollection" component={SampleViewContainer} onEnter={requireAuth} />
               <Route path="logging" component={LoggerContainer} onEnter={requireAuth} />
              </Route>
              <Route path="/login" component={LoginContainer} />
            </Router>
          </Provider>);
  }
}

ReactDOM.render(
  <App />,
  document.getElementById('main')
);
