.PHONY: install
install:
	docker compose build && make start

.PHONY: start
start:
	docker compose start

.PHONY: build
build: start
	docker exec -it imager-client bash -c "npm run build && python3 -m build"

.PHONY: test
test: start
	docker exec -it imager-client bash -c "go run test/*.go"

.PHONY: publish
publish: start
	docker exec -it imager-client bash -c "go run test/*.go && npm run build && python3 -m build"

