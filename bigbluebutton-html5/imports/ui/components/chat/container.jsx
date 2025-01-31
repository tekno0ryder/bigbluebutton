import React, { PureComponent } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import { withTracker } from 'meteor/react-meteor-data';
import { Session } from 'meteor/session';
import Auth from '/imports/ui/services/auth';
import Chat from './component';
import ChatService from './service';

const CHAT_CONFIG = Meteor.settings.public.chat;
const PUBLIC_CHAT_KEY = CHAT_CONFIG.public_id;
const CHAT_CLEAR = CHAT_CONFIG.system_messages_keys.chat_clear;
const ROLE_MODERATOR = Meteor.settings.public.user.role_moderator;
const CONNECTION_STATUS = 'online';

const intlMessages = defineMessages({
  [CHAT_CLEAR]: {
    id: 'app.chat.clearPublicChatMessage',
    description: 'message of when clear the public chat',
  },
  titlePublic: {
    id: 'app.chat.titlePublic',
    description: 'Public chat title',
  },
  titlePrivate: {
    id: 'app.chat.titlePrivate',
    description: 'Private chat title',
  },
  partnerDisconnected: {
    id: 'app.chat.partnerDisconnected',
    description: 'System chat message when the private chat partnet disconnect from the meeting',
  },
});

class ChatContainer extends PureComponent {
  componentDidMount() {
    // in case of reopening a chat, need to make sure it's removed from closed list
    ChatService.removeFromClosedChatsSession();
  }

  render() {
    const { children } = this.props;
    return (
      <Chat {...this.props}>
        {children}
      </Chat>
    );
  }
}

export default injectIntl(withTracker(({ intl }) => {
  const chatID = Session.get('idChatOpen') || PUBLIC_CHAT_KEY;
  let messages = [];
  let isChatLocked = ChatService.isChatLocked(chatID);
  let title = intl.formatMessage(intlMessages.titlePublic);
  let chatName = title;
  let partnerIsLoggedOut = false;
  let systemMessageIntl = {};

  if (chatID === PUBLIC_CHAT_KEY) {
    const { welcomeProp } = ChatService.getMeeting();
    const currentUser = ChatService.getUser(Auth.userID);

    messages = ChatService.getPublicGroupMessages();

    const time = currentUser.loginTime;
    const welcomeId = `welcome-msg-${time}`;

    const welcomeMsg = {
      id: welcomeId,
      content: [{
        id: welcomeId,
        text: welcomeProp.welcomeMsg,
        time,
      }],
      time,
      sender: null,
    };

    const moderatorTime = time + 1;
    const moderatorId = `moderator-msg-${moderatorTime}`;

    const moderatorMsg = {
      id: moderatorId,
      content: [{
        id: moderatorId,
        text: welcomeProp.modOnlyMessage,
        time: moderatorTime,
      }],
      time: moderatorTime,
      sender: null,
    };

    const messagesBeforeWelcomeMsg = ChatService.reduceAndMapGroupMessages(
      messages.filter(message => message.timestamp < time),
    );
    const messagesAfterWelcomeMsg = ChatService.reduceAndMapGroupMessages(
      messages.filter(message => message.timestamp >= time),
    );

    const messagesFormated = messagesBeforeWelcomeMsg
      .concat(welcomeMsg)
      .concat(currentUser.role === ROLE_MODERATOR ? moderatorMsg : [])
      .concat(messagesAfterWelcomeMsg);

    messages = messagesFormated.sort((a, b) => (a.time - b.time));
  } else {
    messages = ChatService.getPrivateGroupMessages();

    const receiverUser = ChatService.getUser(chatID);
    chatName = receiverUser.name;
    systemMessageIntl = { 0: receiverUser.name };
    title = intl.formatMessage(intlMessages.titlePrivate, systemMessageIntl);
    partnerIsLoggedOut = receiverUser.connectionStatus !== CONNECTION_STATUS;

    if (partnerIsLoggedOut) {
      const time = Date.now();
      const id = `partner-disconnected-${time}`;
      const messagePartnerLoggedOut = {
        id,
        content: [{
          id,
          text: 'partnerDisconnected',
          time,
        }],
        time,
        sender: null,
      };

      messages.push(messagePartnerLoggedOut);
      isChatLocked = true;
    }
  }

  messages = messages.map((message) => {
    if (message.sender) return message;

    return {
      ...message,
      content: message.content.map(content => ({
        ...content,
        text: content.text in intlMessages
          ? `<b><i>${intl.formatMessage(intlMessages[content.text], systemMessageIntl)}</i></b>` : content.text,
      })),
    };
  });

  const { connected: isMeteorConnected } = Meteor.status();

  return {
    chatID,
    chatName,
    title,
    messages,
    partnerIsLoggedOut,
    isChatLocked,
    isMeteorConnected,
    actions: {
      handleClosePrivateChat: ChatService.closePrivateChat,
    },
  };
})(ChatContainer));
