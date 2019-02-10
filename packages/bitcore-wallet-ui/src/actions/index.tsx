// import _ from 'lodash';
// import jsonPlaceholder from '../api/jsonPlaceholder';

// export const fetchPostsandUpdate = () => async (dispatch, getState) => {
//   await dispatch(fetchPosts());
//   const userIds = _.uniq(_.map(getState().posts, 'userId'));
//   userIds.forEach(id => dispatch(fetchUser(id)));
// };

// export const fetchPosts = () => async dispatch => {
//   const res = await jsonPlaceholder.get('/posts');

//   dispatch({
//     type: 'FETCH_POSTS',
//     payload: res.data
//   });
// };

// export const fetchUser = id => async dispatch => {
//   const response = await jsonPlaceholder.get(`/users/${id}`);

//   dispatch({ type: 'FETCH_USER', payload: response.data });
// };
