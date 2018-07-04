/**
 * Tests for get.js
 */
import chai from 'chai';
import request from 'supertest';

import models from '../../models';
import server from '../../app';
import testUtil from '../../tests/util';

const should = chai.should();

describe('GET project type', () => {
  const type = {
    key: 'key1',
    displayName: 'displayName 1',
    icon: 'http://example.com/icon1.ico',
    question: 'question 1',
    info: 'info 1',
    aliases: ['key-1', 'key_1'],
    disabled: true,
    hidden: true,
    createdBy: 1,
    updatedBy: 1,
  };

  const key = type.key;

  beforeEach(() => testUtil.clearDb()
    .then(() => models.ProjectType.create(type))
    .then(() => Promise.resolve()),
  );
  after(testUtil.clearDb);

  describe('GET /projectTypes/{key}', () => {
    it('should return 403 if user is not authenticated', (done) => {
      request(server)
        .get(`/v4/projectTypes/${key}`)
        .expect(403, done);
    });

    it('should return 404 for non-existed type', (done) => {
      request(server)
        .get('/v4/projectTypes/1234')
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect(404, done);
    });

    it('should return 404 for deleted type', (done) => {
      models.ProjectType.destroy({ where: { key } })
        .then(() => {
          request(server)
            .get(`/v4/projectTypes/${key}`)
            .set({
              Authorization: `Bearer ${testUtil.jwts.admin}`,
            })
            .expect(404, done);
        });
    });

    it('should return 200 for admin', (done) => {
      request(server)
        .get(`/v4/projectTypes/${key}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect(200)
        .end((err, res) => {
          const resJson = res.body.result.content;
          resJson.key.should.be.eql(type.key);
          resJson.displayName.should.be.eql(type.displayName);
          resJson.icon.should.be.eql(type.icon);
          resJson.info.should.be.eql(type.info);
          resJson.question.should.be.eql(type.question);
          resJson.aliases.should.be.eql(type.aliases);
          resJson.disabled.should.be.eql(type.disabled);
          resJson.hidden.should.be.eql(type.hidden);
          resJson.createdBy.should.be.eql(type.createdBy);
          should.exist(resJson.createdAt);
          resJson.updatedBy.should.be.eql(type.updatedBy);
          should.exist(resJson.updatedAt);
          should.not.exist(resJson.deletedBy);
          should.not.exist(resJson.deletedAt);

          done();
        });
    });

    it('should return 200 for connect admin', (done) => {
      request(server)
        .get(`/v4/projectTypes/${key}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.connectAdmin}`,
        })
        .expect(200)
        .end(done);
    });

    it('should return 200 for connect manager', (done) => {
      request(server)
        .get(`/v4/projectTypes/${key}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .expect(200)
        .end(done);
    });

    it('should return 200 for member', (done) => {
      request(server)
        .get(`/v4/projectTypes/${key}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .expect(200, done);
    });

    it('should return 200 for copilot', (done) => {
      request(server)
        .get(`/v4/projectTypes/${key}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .expect(200, done);
    });
  });
});
