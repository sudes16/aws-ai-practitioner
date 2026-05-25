import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', ...) on native
// and ReactDOM.render on web — this is what mounts the app to #root
registerRootComponent(App);
